"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { appointments } from "@/db/schema";
import { getCurrentOrg } from "@/features/org/current";
import type { AppointmentStatus } from "@/db/schema";

const ALLOWED: AppointmentStatus[] = [
  "reservado",
  "confirmado",
  "atendido",
  "cancelado",
  "no_show",
];

/** Change an appointment's status (scoped to the caller's organization). */
export async function updateAppointmentStatus(id: string, status: AppointmentStatus) {
  if (!ALLOWED.includes(status)) {
    return { ok: false as const, error: "Estado inválido" };
  }
  const { org } = await getCurrentOrg();
  if (!org) return { ok: false as const, error: "No autorizado" };

  await db
    .update(appointments)
    .set({ status })
    .where(and(eq(appointments.id, id), eq(appointments.organizationId, org.id)));

  revalidatePath("/dashboard/agenda");
  return { ok: true as const };
}
