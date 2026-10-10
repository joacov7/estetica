"use server";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { promotions, services, giftCards } from "@/db/schema";

export interface PromoValidation {
  ok: true;
  name: string;
  discountCents: number;
}
export type PromoResult = PromoValidation | { ok: false; error: string };

/** Compute the discount for a promo code against the selected services' subtotal. */
async function computePromo(
  organizationId: string,
  code: string,
  serviceIds: string[],
): Promise<PromoResult> {
  const clean = code.trim().toUpperCase();
  if (!clean) return { ok: false, error: "Ingresá un código." };
  if (serviceIds.length === 0) return { ok: false, error: "Elegí un servicio primero." };

  const [promo] = await db
    .select()
    .from(promotions)
    .where(and(eq(promotions.organizationId, organizationId), eq(promotions.code, clean)))
    .limit(1);
  if (!promo || !promo.isActive) return { ok: false, error: "Código inválido o inactivo." };

  const now = new Date();
  if (promo.startsAt && new Date(promo.startsAt) > now) return { ok: false, error: "Esta promo todavía no empezó." };
  if (promo.endsAt && new Date(promo.endsAt) < now) return { ok: false, error: "Esta promo ya venció." };

  const svc = await db
    .select({ priceCents: services.priceCents })
    .from(services)
    .where(and(eq(services.organizationId, organizationId), inArray(services.id, serviceIds), eq(services.isActive, true)));
  const subtotal = svc.reduce((s, x) => s + x.priceCents, 0);
  if (subtotal === 0) return { ok: false, error: "No hay importe sobre el que aplicar la promo." };

  const raw = promo.discountType === "percentage"
    ? Math.round((subtotal * promo.discountValue) / 100)
    : Math.round(promo.discountValue); // fixed stored in cents
  const discountCents = Math.max(0, Math.min(raw, subtotal));
  if (discountCents === 0) return { ok: false, error: "La promo no genera descuento." };

  return { ok: true, name: promo.name, discountCents };
}

/** Public: validate a promo code for display in the booking wizard. */
export async function validatePromoCode(input: {
  organizationId: string;
  code: string;
  serviceIds: string[];
}): Promise<PromoResult> {
  return computePromo(input.organizationId, input.code, input.serviceIds);
}

/** Resolve a promo during booking; returns id + discount or null (never throws). */
export async function resolvePromoForBooking(
  organizationId: string,
  code: string | undefined,
  serviceIds: string[],
): Promise<{ promotionId: string; discountCents: number; name: string } | null> {
  if (!code?.trim()) return null;
  const clean = code.trim().toUpperCase();
  const res = await computePromo(organizationId, clean, serviceIds);
  if (!res.ok) return null;
  const [promo] = await db
    .select({ id: promotions.id })
    .from(promotions)
    .where(and(eq(promotions.organizationId, organizationId), eq(promotions.code, clean)))
    .limit(1);
  if (!promo) return null;
  return { promotionId: promo.id, discountCents: res.discountCents, name: res.name };
}

/** Public: check a gift card's balance (read-only; redemption happens in-salon). */
export async function checkGiftCard(input: {
  organizationId: string;
  code: string;
}): Promise<{ ok: true; balanceCents: number } | { ok: false; error: string }> {
  const clean = input.code.trim().toUpperCase();
  if (!clean) return { ok: false, error: "Ingresá el código." };
  const [card] = await db
    .select({ balanceCents: giftCards.balanceCents, status: giftCards.status })
    .from(giftCards)
    .where(and(eq(giftCards.organizationId, input.organizationId), eq(giftCards.code, clean)))
    .limit(1);
  if (!card || card.status !== "active") return { ok: false, error: "Gift card no encontrada o sin saldo." };
  if (card.balanceCents <= 0) return { ok: false, error: "Esta gift card no tiene saldo." };
  return { ok: true, balanceCents: card.balanceCents };
}
