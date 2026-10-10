"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { giftCards } from "@/db/schema";
import { getCurrentOrg } from "@/features/org/current";
import { generateReferralCode } from "@/lib/referral";
import { giftCardSchema, redeemGiftCardSchema, type GiftCardInput } from "@/lib/validations/loyalty";

const WRITE_ROLES = ["owner", "admin"];

export async function createGiftCard(input: GiftCardInput) {
  const parsed = giftCardSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { org, role } = await getCurrentOrg();
  if (!org || !role || !WRITE_ROLES.includes(role)) return { ok: false as const, error: "No autorizado" };

  const cents = Math.round(parsed.data.amount * 100);
  // Try a few codes in case of a collision with the per-org unique constraint.
  for (let i = 0; i < 5; i++) {
    const code = (parsed.data.code || `GC-${generateReferralCode(6)}`).toUpperCase();
    try {
      await db.insert(giftCards).values({
        organizationId: org.id,
        code,
        initialCents: cents,
        balanceCents: cents,
        note: parsed.data.note || null,
      });
      revalidatePath("/dashboard/gift-cards");
      return { ok: true as const, code };
    } catch (e) {
      const c = (e as { code?: string })?.code;
      if (c === "23505" && !parsed.data.code) continue; // regenerate auto code
      if (c === "23505") return { ok: false as const, error: "Ese código ya existe." };
      return { ok: false as const, error: "No se pudo crear la gift card." };
    }
  }
  return { ok: false as const, error: "No se pudo crear la gift card." };
}

export async function redeemGiftCard(input: { giftCardId: string; amount: number }) {
  const parsed = redeemGiftCardSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Datos inválidos" };
  const { org, role } = await getCurrentOrg();
  if (!org || !role || !WRITE_ROLES.includes(role)) return { ok: false as const, error: "No autorizado" };

  const cents = Math.round(parsed.data.amount * 100);
  if (cents <= 0) return { ok: false as const, error: "Monto inválido" };

  // Atomic debit: the WHERE guards against double-spend under concurrency.
  // balance - cents is computed in SQL, so two concurrent redeems can't both
  // read a stale balance (no lost update).
  const [updated] = await db
    .update(giftCards)
    .set({
      balanceCents: sql`${giftCards.balanceCents} - ${cents}`,
      status: sql`CASE WHEN ${giftCards.balanceCents} - ${cents} = 0 THEN 'redeemed' ELSE ${giftCards.status} END`,
    })
    .where(
      and(
        eq(giftCards.id, parsed.data.giftCardId),
        eq(giftCards.organizationId, org.id),
        eq(giftCards.status, "active"),
        gte(giftCards.balanceCents, cents),
      ),
    )
    .returning({ id: giftCards.id });

  if (!updated) {
    // Either not found/inactive or insufficient balance — don't leak which.
    return { ok: false as const, error: "No se pudo canjear: saldo insuficiente o gift card inactiva." };
  }

  revalidatePath("/dashboard/gift-cards");
  return { ok: true as const };
}
