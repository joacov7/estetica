"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { giftCards } from "@/db/schema";
import { getCurrentOrg } from "@/features/org/current";
import { generateReferralCode } from "@/lib/referral";
import { giftCardSchema, redeemGiftCardSchema, type GiftCardInput } from "@/lib/validations/loyalty";

export async function createGiftCard(input: GiftCardInput) {
  const parsed = giftCardSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { org } = await getCurrentOrg();
  if (!org) return { ok: false as const, error: "No autorizado" };

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
  const { org } = await getCurrentOrg();
  if (!org) return { ok: false as const, error: "No autorizado" };

  const [card] = await db
    .select()
    .from(giftCards)
    .where(and(eq(giftCards.id, parsed.data.giftCardId), eq(giftCards.organizationId, org.id)))
    .limit(1);
  if (!card) return { ok: false as const, error: "Gift card no encontrada" };
  if (card.status !== "active") return { ok: false as const, error: "Esta gift card no está activa." };

  const cents = Math.round(parsed.data.amount * 100);
  if (cents > card.balanceCents) return { ok: false as const, error: "El monto supera el saldo." };

  const newBalance = card.balanceCents - cents;
  await db
    .update(giftCards)
    .set({ balanceCents: newBalance, status: newBalance === 0 ? "redeemed" : "active" })
    .where(eq(giftCards.id, card.id));

  revalidatePath("/dashboard/gift-cards");
  return { ok: true as const };
}
