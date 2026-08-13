"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { appointments, notifications } from "@/db/schema";
import { getCurrentOrg } from "@/features/org/current";

/** Record that a 24h WhatsApp reminder was sent for an appointment (idempotent). */
export async function markReminderSent(appointmentId: string) {
  const { org } = await getCurrentOrg();
  if (!org) return { ok: false as const, error: "No autorizado" };

  // Verify the appointment belongs to this organization.
  const [appt] = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(and(eq(appointments.id, appointmentId), eq(appointments.organizationId, org.id)))
    .limit(1);
  if (!appt) return { ok: false as const, error: "Turno no encontrado" };

  // Don't duplicate a reminder for the same appointment.
  const [existing] = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.appointmentId, appointmentId), eq(notifications.type, "reminder_24h")))
    .limit(1);

  if (!existing) {
    await db.insert(notifications).values({
      organizationId: org.id,
      appointmentId,
      type: "reminder_24h",
      channel: "whatsapp",
      sentAt: new Date().toISOString(),
    });
  }

  revalidatePath("/dashboard/recordatorios");
  return { ok: true as const };
}
