"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { promotions } from "@/db/schema";
import { getCurrentOrg } from "@/features/org/current";
import { promotionFormSchema, type PromotionFormInput } from "@/lib/validations/promotion";

const WRITE_ROLES = ["owner", "admin"];

export async function createPromotion(input: PromotionFormInput) {
  const parsed = promotionFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { org, role } = await getCurrentOrg();
  if (!org || !role || !WRITE_ROLES.includes(role)) {
    return { ok: false as const, error: "No autorizado" };
  }
  const v = parsed.data;
  // Fixed discount entered in pesos → stored as cents; percentage as-is.
  const value = v.discountType === "fixed" ? Math.round(v.discountValue * 100) : v.discountValue;

  await db.insert(promotions).values({
    organizationId: org.id,
    name: v.name,
    code: v.code || null,
    discountType: v.discountType,
    discountValue: value,
    isActive: true,
  });

  revalidatePath("/dashboard/promociones");
  return { ok: true as const };
}

export async function togglePromotion(id: string, isActive: boolean) {
  const { org, role } = await getCurrentOrg();
  if (!org || !role || !WRITE_ROLES.includes(role)) {
    return { ok: false as const, error: "No autorizado" };
  }
  await db
    .update(promotions)
    .set({ isActive })
    .where(and(eq(promotions.id, id), eq(promotions.organizationId, org.id)));
  revalidatePath("/dashboard/promociones");
  return { ok: true as const };
}
