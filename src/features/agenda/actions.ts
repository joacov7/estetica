"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/db";
import { appointments, appointmentServices, clients, services } from "@/db/schema";
import { getCurrentOrg } from "@/features/org/current";
import { getAvailableSlots } from "@/services/availability";
import { manualBookingSchema, type ManualBookingInput } from "@/lib/validations/booking";
import { generateReferralCode } from "@/lib/referral";
import type { AppointmentStatus } from "@/db/schema";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generateCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return code;
}
function pgCode(e: unknown): string | undefined {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code ?? err?.cause?.code;
}

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

export type ManualBookingResult =
  | { ok: true }
  | { ok: false; error: string; slotTaken?: boolean };

/** Create an appointment manually from the admin agenda (source = 'manual'). */
export async function createManualAppointment(
  input: ManualBookingInput,
): Promise<ManualBookingResult> {
  const parsed = manualBookingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const data = parsed.data;

  const { org } = await getCurrentOrg();
  if (!org) return { ok: false, error: "No autorizado" };

  const svc = await db
    .select({
      id: services.id,
      name: services.name,
      priceCents: services.priceCents,
      durationMin: services.durationMin,
      bufferMin: services.bufferMin,
      isActive: services.isActive,
    })
    .from(services)
    .where(and(eq(services.organizationId, org.id), inArray(services.id, data.serviceIds)));
  if (svc.length !== data.serviceIds.length) {
    return { ok: false, error: "Servicio no disponible" };
  }
  const slotLength = svc.reduce((s, x) => s + x.durationMin + x.bufferMin, 0);

  // Re-validate the slot on the server.
  const date = formatInTimeZone(data.startIso, org.timezone, "yyyy-MM-dd");
  const slots = await getAvailableSlots({
    organizationId: org.id,
    professionalId: data.professionalId,
    serviceIds: data.serviceIds,
    date,
    timezone: org.timezone,
  });
  if (!slots.some((s) => s.startIso === data.startIso)) {
    return { ok: false, error: "Ese horario ya no está disponible.", slotTaken: true };
  }

  const startAt = new Date(data.startIso).toISOString();
  const endAt = new Date(new Date(data.startIso).getTime() + slotLength * 60000).toISOString();

  for (let attempt = 0; attempt < 4; attempt++) {
    const bookingCode = generateCode();
    try {
      await db.transaction(async (tx) => {
        const [client] = await tx
          .insert(clients)
          .values({ organizationId: org.id, name: data.clientName, phone: data.clientPhone, referralCode: generateReferralCode() })
          .onConflictDoUpdate({
            target: [clients.organizationId, clients.phone],
            set: { name: data.clientName },
          })
          .returning({ id: clients.id });

        const [appt] = await tx
          .insert(appointments)
          .values({
            organizationId: org.id,
            professionalId: data.professionalId,
            clientId: client.id,
            startAt,
            endAt,
            status: "reservado",
            source: "manual",
            bookingCode,
          })
          .returning({ id: appointments.id });

        await tx.insert(appointmentServices).values(
          svc.map((s) => ({
            appointmentId: appt.id,
            serviceId: s.id,
            name: s.name,
            priceCents: s.priceCents,
            durationMin: s.durationMin,
          })),
        );
      });

      revalidatePath("/dashboard/agenda");
      return { ok: true };
    } catch (e) {
      const code = pgCode(e);
      if (code === "23P01") {
        return { ok: false, error: "Ese horario acaba de ser reservado.", slotTaken: true };
      }
      if (code !== "23505") {
        return { ok: false, error: "No pudimos crear el turno. Intentá de nuevo." };
      }
    }
  }
  return { ok: false, error: "No pudimos crear el turno. Intentá de nuevo." };
}
