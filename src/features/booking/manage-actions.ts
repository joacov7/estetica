"use server";

import { formatInTimeZone } from "date-fns-tz";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { appointments, appointmentServices, organizations } from "@/db/schema";
import { verifyBookingToken } from "@/lib/booking-token";
import { getAvailableSlots } from "@/services/availability";

export type ManageResult = { ok: true } | { ok: false; error: string; slotTaken?: boolean };

/** Load and authorize an appointment from a signed management token. */
async function fromToken(token: string) {
  const payload = verifyBookingToken(token);
  if (!payload) return null;
  const [appt] = await db
    .select()
    .from(appointments)
    .where(and(eq(appointments.id, payload.appointmentId), eq(appointments.bookingCode, payload.bookingCode)))
    .limit(1);
  return appt ?? null;
}

export async function cancelAppointmentByToken(token: string): Promise<ManageResult> {
  const appt = await fromToken(token);
  if (!appt) return { ok: false, error: "Enlace inválido." };
  if (appt.status === "cancelado") return { ok: true };
  if (appt.status === "atendido") return { ok: false, error: "Este turno ya fue atendido." };

  await db.update(appointments).set({ status: "cancelado" }).where(eq(appointments.id, appt.id));
  return { ok: true };
}

export async function rescheduleAppointmentByToken(token: string, newStartIso: string): Promise<ManageResult> {
  const appt = await fromToken(token);
  if (!appt) return { ok: false, error: "Enlace inválido." };
  if (appt.status === "cancelado" || appt.status === "atendido") {
    return { ok: false, error: "Este turno no se puede reprogramar." };
  }

  const [org] = await db
    .select({ timezone: organizations.timezone })
    .from(organizations)
    .where(eq(organizations.id, appt.organizationId))
    .limit(1);
  if (!org) return { ok: false, error: "Negocio no encontrado" };

  const svcRows = await db
    .select({ serviceId: appointmentServices.serviceId })
    .from(appointmentServices)
    .where(and(eq(appointmentServices.appointmentId, appt.id), isNotNull(appointmentServices.serviceId)));
  const serviceIds = svcRows.map((s) => s.serviceId!).filter(Boolean);
  if (serviceIds.length === 0) return { ok: false, error: "No pudimos reprogramar este turno." };

  // Re-validate the new slot server-side, ignoring this same appointment.
  const date = formatInTimeZone(newStartIso, org.timezone, "yyyy-MM-dd");
  const slots = await getAvailableSlots({
    organizationId: appt.organizationId,
    professionalId: appt.professionalId,
    serviceIds,
    date,
    timezone: org.timezone,
    excludeAppointmentId: appt.id,
  });
  if (!slots.some((s) => s.startIso === newStartIso)) {
    return { ok: false, error: "Ese horario ya no está disponible.", slotTaken: true };
  }

  // Keep the same total duration as the original appointment.
  const durationMs = new Date(appt.endAt).getTime() - new Date(appt.startAt).getTime();
  const newStart = new Date(newStartIso).toISOString();
  const newEnd = new Date(new Date(newStartIso).getTime() + durationMs).toISOString();

  try {
    await db
      .update(appointments)
      .set({ startAt: newStart, endAt: newEnd, status: "reservado" })
      .where(eq(appointments.id, appt.id));
  } catch (e) {
    const code = (e as { code?: string; cause?: { code?: string } })?.code ?? (e as { cause?: { code?: string } })?.cause?.code;
    if (code === "23P01") return { ok: false, error: "Ese horario acaba de ser reservado.", slotTaken: true };
    return { ok: false, error: "No pudimos reprogramar. Intentá de nuevo." };
  }
  return { ok: true };
}
