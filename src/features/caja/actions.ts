"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { getCurrentOrg } from "@/features/org/current";
import { paymentFormSchema, type PaymentFormInput } from "@/lib/validations/payment";

/** Record a cash-register movement (payment/deposit/tip/refund). */
export async function recordPayment(input: PaymentFormInput) {
  const parsed = paymentFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { org } = await getCurrentOrg();
  if (!org) return { ok: false as const, error: "No autorizado" };

  const v = parsed.data;
  await db.insert(payments).values({
    organizationId: org.id,
    kind: v.kind,
    method: v.method,
    amountCents: Math.round(v.amount * 100),
    status: "paid",
    provider: "manual",
  });

  revalidatePath("/dashboard/caja");
  return { ok: true as const };
}
