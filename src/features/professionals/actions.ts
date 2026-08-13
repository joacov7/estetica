"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { professionals } from "@/db/schema";
import { getCurrentOrg } from "@/features/org/current";
import {
  professionalFormSchema,
  parseSpecialties,
  type ProfessionalFormInput,
} from "@/lib/validations/professional";

const WRITE_ROLES = ["owner", "admin"];

export async function createProfessional(input: ProfessionalFormInput) {
  const parsed = professionalFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { org, role } = await getCurrentOrg();
  if (!org || !role || !WRITE_ROLES.includes(role)) {
    return { ok: false as const, error: "No autorizado" };
  }

  const v = parsed.data;
  await db.insert(professionals).values({
    organizationId: org.id,
    name: v.name,
    specialties: parseSpecialties(v.specialties),
    isActive: v.isActive,
  });

  revalidatePath("/dashboard/profesionales");
  revalidatePath("/dashboard/agenda");
  return { ok: true as const };
}

export async function toggleProfessional(id: string, isActive: boolean) {
  const { org, role } = await getCurrentOrg();
  if (!org || !role || !WRITE_ROLES.includes(role)) {
    return { ok: false as const, error: "No autorizado" };
  }
  await db
    .update(professionals)
    .set({ isActive })
    .where(and(eq(professionals.id, id), eq(professionals.organizationId, org.id)));

  revalidatePath("/dashboard/profesionales");
  revalidatePath("/dashboard/agenda");
  return { ok: true as const };
}
