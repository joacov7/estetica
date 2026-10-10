"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { clients, loyaltyTransactions } from "@/db/schema";
import { getCurrentOrg } from "@/features/org/current";

const WRITE_ROLES = ["owner", "admin"];

async function guard(clientId: string) {
  const { org, role } = await getCurrentOrg();
  if (!org || !role || !WRITE_ROLES.includes(role)) return null;
  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.organizationId, org.id)))
    .limit(1);
  return client ? org : null;
}

/** Thrown inside a tx to roll back with the caller-facing balance. */
class InsufficientPoints extends Error {
  constructor(public balance: number) {
    super("insufficient");
  }
}

/**
 * Debit/credit the ledger atomically for one client. A per-client transaction
 * advisory lock serializes concurrent writes, so the balance read and the
 * insert can't race (no negative balance / over-redeem under concurrency).
 */
async function writeLedger(
  orgId: string,
  clientId: string,
  points: number,
  kind: "redeem" | "adjust",
  reason: string,
  requireBalance: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await db.transaction(async (tx) => {
      // Serialize concurrent ledger writes for this org+client.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`${orgId}:${clientId}`}))`);

      if (requireBalance) {
        const [row] = await tx
          .select({ total: sql<number>`coalesce(sum(${loyaltyTransactions.points}), 0)` })
          .from(loyaltyTransactions)
          .where(and(eq(loyaltyTransactions.organizationId, orgId), eq(loyaltyTransactions.clientId, clientId)));
        const balance = Number(row?.total ?? 0);
        if (Math.abs(points) > balance) throw new InsufficientPoints(balance);
      }

      await tx.insert(loyaltyTransactions).values({
        organizationId: orgId,
        clientId,
        points,
        kind,
        reason: reason.slice(0, 200),
      });
    });
  } catch (e) {
    if (e instanceof InsufficientPoints) {
      return { ok: false, error: `Solo tiene ${e.balance} puntos disponibles.` };
    }
    throw e;
  }
  revalidatePath(`/dashboard/clientes/${clientId}`);
  return { ok: true };
}

/** Redeem points (negative ledger entry). Caps at the current balance. */
export async function redeemPoints(
  clientId: string,
  points: number,
  reason?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const org = await guard(clientId);
  if (!org) return { ok: false, error: "No autorizado" };
  const n = Math.floor(Number(points));
  if (!Number.isFinite(n) || n <= 0) return { ok: false, error: "Cantidad inválida" };
  return writeLedger(org.id, clientId, -n, "redeem", reason ?? "Canje de puntos", true);
}

/** Manually add or subtract points (owner/admin correction). */
export async function adjustPoints(
  clientId: string,
  points: number,
  reason?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const org = await guard(clientId);
  if (!org) return { ok: false, error: "No autorizado" };
  const n = Math.trunc(Number(points));
  if (!Number.isFinite(n) || n === 0) return { ok: false, error: "Cantidad inválida" };
  // Only a negative adjustment needs the balance guard.
  return writeLedger(org.id, clientId, n, "adjust", reason ?? "Ajuste manual", n < 0);
}
