"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { services } from "@/db/schema";
import { getCurrentOrg } from "@/features/org/current";
import { serviceFormSchema, type ServiceFormInput } from "@/lib/validations/service";

const WRITE_ROLES = ["owner", "admin"];

export async function createService(input: ServiceFormInput) {
  const parsed = serviceFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { org, role } = await getCurrentOrg();
  if (!org || !role || !WRITE_ROLES.includes(role)) {
    return { ok: false as const, error: "No autorizado" };
  }

  const v = parsed.data;
  await db.insert(services).values({
    organizationId: org.id,
    categoryId: v.categoryId || null,
    name: v.name,
    description: v.description || null,
    priceCents: Math.round(v.price * 100),
    durationMin: v.durationMin,
    bufferMin: v.bufferMin,
    depositType: v.depositType,
    depositValue: v.depositValue,
    isActive: v.isActive,
  });

  revalidatePath("/dashboard/servicios");
  return { ok: true as const };
}

export async function toggleService(id: string, isActive: boolean) {
  const { org, role } = await getCurrentOrg();
  if (!org || !role || !WRITE_ROLES.includes(role)) {
    return { ok: false as const, error: "No autorizado" };
  }
  // Scope the update to the caller's org (tenancy enforced in the query layer).
  await db
    .update(services)
    .set({ isActive })
    .where(and(eq(services.id, id), eq(services.organizationId, org.id)));

  revalidatePath("/dashboard/servicios");
  return { ok: true as const };
}
