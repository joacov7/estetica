"use server";

import { headers } from "next/headers";
import { formatInTimeZone } from "date-fns-tz";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  organizations,
  services,
  clients,
  appointments,
  appointmentServices,
} from "@/db/schema";
import { getAvailableSlots } from "@/services/availability";
import { bookingSchema, type BookingInput } from "@/lib/validations/booking";
import { createBookingToken } from "@/lib/booking-token";
import { bookingLimiter } from "@/lib/rate-limit";

export type BookingResult =
  | { ok: true; bookingCode: string; manageToken: string }
  | { ok: false; error: string; slotTaken?: boolean };

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generateCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return code;
}

/** Extract a Postgres SQLSTATE code from a thrown error (postgres.js / drizzle). */
function pgCode(e: unknown): string | undefined {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code ?? err?.cause?.code;
}

/**
 * Create a booking from the public (anonymous) flow.
 * Validates input, re-checks availability, and relies on the DB exclusion
 * constraint as the hard guarantee against double-booking.
 */
export async function createPublicBooking(input: BookingInput): Promise<BookingResult> {
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const data = parsed.data;

  // --- rate limit by IP + phone -------------------------------------------
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limited = await bookingLimiter.check(`${ip}:${data.client.phone}`);
  if (!limited.ok) {
    return { ok: false, error: "Demasiados intentos. Probá de nuevo en unos minutos." };
  }

  // --- org (timezone) ------------------------------------------------------
  const [org] = await db
    .select({ id: organizations.id, timezone: organizations.timezone })
    .from(organizations)
    .where(eq(organizations.id, data.organizationId))
    .limit(1);
  if (!org) return { ok: false, error: "Negocio no encontrado" };

  // --- services (must belong to org & be active) ---------------------------
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
    .where(and(eq(services.organizationId, data.organizationId), inArray(services.id, data.serviceIds)));
  if (svc.length !== data.serviceIds.length || svc.some((s) => !s.isActive)) {
    return { ok: false, error: "Servicio no disponible" };
  }
  const slotLength = svc.reduce((s, x) => s + x.durationMin + x.bufferMin, 0);

  // --- re-validate the slot server-side ------------------------------------
  const date = formatInTimeZone(data.startIso, org.timezone, "yyyy-MM-dd");
  const slots = await getAvailableSlots({
    organizationId: data.organizationId,
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

  // --- create booking atomically, retrying only on code collision ----------
  for (let attempt = 0; attempt < 4; attempt++) {
    const bookingCode = generateCode();
    try {
      const appointmentId = await db.transaction(async (tx) => {
        const [client] = await tx
          .insert(clients)
          .values({
            organizationId: data.organizationId,
            name: data.client.name,
            phone: data.client.phone,
            email: data.client.email || null,
          })
          .onConflictDoUpdate({
            target: [clients.organizationId, clients.phone],
            set: { name: data.client.name, email: data.client.email || null },
          })
          .returning({ id: clients.id });

        const [appt] = await tx
          .insert(appointments)
          .values({
            organizationId: data.organizationId,
            professionalId: data.professionalId,
            clientId: client.id,
            startAt,
            endAt,
            status: "reservado",
            source: "online",
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

        return appt.id;
      });

      return { ok: true, bookingCode, manageToken: createBookingToken(appointmentId, bookingCode) };
    } catch (e) {
      const code = pgCode(e);
      if (code === "23P01") {
        return { ok: false, error: "Ese horario acaba de ser reservado.", slotTaken: true };
      }
      if (code !== "23505") {
        return { ok: false, error: "No pudimos confirmar el turno. Intentá de nuevo." };
      }
      // 23505: booking_code collision → retry with a new code.
    }
  }
  return { ok: false, error: "No pudimos confirmar el turno. Intentá de nuevo." };
}
