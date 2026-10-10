"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { clients, loyaltyTransactions } from "@/db/schema";
import { getCurrentOrg } from "@/features/org/current";
import { getPointsBalance } from "./points";

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

  const balance = await getPointsBalance(org.id, clientId);
  if (n > balance) return { ok: false, error: `Solo tiene ${balance} puntos disponibles.` };

  await db.insert(loyaltyTransactions).values({
    organizationId: org.id,
    clientId,
    points: -n,
    kind: "redeem",
    reason: (reason ?? "Canje de puntos").slice(0, 200),
  });
  revalidatePath(`/dashboard/clientes/${clientId}`);
  return { ok: true };
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

  if (n < 0) {
    const balance = await getPointsBalance(org.id, clientId);
    if (Math.abs(n) > balance) return { ok: false, error: `Solo tiene ${balance} puntos.` };
  }

  await db.insert(loyaltyTransactions).values({
    organizationId: org.id,
    clientId,
    points: n,
    kind: "adjust",
    reason: (reason ?? "Ajuste manual").slice(0, 200),
  });
  revalidatePath(`/dashboard/clientes/${clientId}`);
  return { ok: true };
}
