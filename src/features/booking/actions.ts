"use server";

import { headers } from "next/headers";
import { formatInTimeZone } from "date-fns-tz";
import { createAdminClient } from "@/lib/supabase/admin";
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
  for (let i = 0; i < 6; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

/**
 * Create a booking from the public (anonymous) flow.
 * Trusted server operation: validates input, re-checks availability, and relies
 * on the DB exclusion constraint as the hard guarantee against double-booking.
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

  const db = createAdminClient();

  // --- org (timezone) ------------------------------------------------------
  const { data: org } = await db
    .from("organizations")
    .select("id, timezone")
    .eq("id", data.organizationId)
    .single();
  if (!org) return { ok: false, error: "Negocio no encontrado" };

  // --- services (must belong to org & be active) ---------------------------
  const { data: services } = await db
    .from("services")
    .select("id, name, price_cents, duration_min, buffer_min, is_active")
    .eq("organization_id", data.organizationId)
    .in("id", data.serviceIds);
  if (!services || services.length !== data.serviceIds.length || services.some((s) => !s.is_active)) {
    return { ok: false, error: "Servicio no disponible" };
  }
  const slotLength = services.reduce((s, x) => s + x.duration_min + x.buffer_min, 0);

  // --- re-validate the slot server-side ------------------------------------
  const date = formatInTimeZone(data.startIso, org.timezone, "yyyy-MM-dd");
  const slots = await getAvailableSlots({
    organizationId: data.organizationId,
    professionalId: data.professionalId,
    serviceIds: data.serviceIds,
    date,
    timezone: org.timezone,
  });
  const chosen = slots.find((s) => s.startIso === data.startIso);
  if (!chosen) {
    return { ok: false, error: "Ese horario ya no está disponible.", slotTaken: true };
  }

  const startAt = new Date(data.startIso);
  const endAt = new Date(startAt.getTime() + slotLength * 60000);

  // --- upsert client by phone ----------------------------------------------
  const { data: client, error: clientErr } = await db
    .from("clients")
    .upsert(
      {
        organization_id: data.organizationId,
        name: data.client.name,
        phone: data.client.phone,
        email: data.client.email || null,
      },
      { onConflict: "organization_id,phone" },
    )
    .select("id")
    .single();
  if (clientErr || !client) {
    return { ok: false, error: "No pudimos guardar tus datos. Intentá de nuevo." };
  }

  // --- insert appointment (retry on code collision) ------------------------
  let appointmentId: string | null = null;
  let bookingCode = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    bookingCode = generateCode();
    const { data: appt, error } = await db
      .from("appointments")
      .insert({
        organization_id: data.organizationId,
        professional_id: data.professionalId,
        client_id: client.id,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        status: "reservado",
        source: "online",
        booking_code: bookingCode,
      })
      .select("id")
      .single();

    if (!error && appt) {
      appointmentId = appt.id;
      break;
    }
    // 23P01 = exclusion_violation (overlap) → someone booked it first.
    if (error?.code === "23P01") {
      return { ok: false, error: "Ese horario acaba de ser reservado.", slotTaken: true };
    }
    // 23505 on booking_code → retry with a new code; otherwise fail.
    if (error?.code !== "23505") {
      return { ok: false, error: "No pudimos confirmar el turno. Intentá de nuevo." };
    }
  }
  if (!appointmentId) {
    return { ok: false, error: "No pudimos confirmar el turno. Intentá de nuevo." };
  }

  // --- snapshot services on the appointment --------------------------------
  await db.from("appointment_services").insert(
    services.map((s) => ({
      appointment_id: appointmentId!,
      service_id: s.id,
      name: s.name,
      price_cents: s.price_cents,
      duration_min: s.duration_min,
    })),
  );

  return {
    ok: true,
    bookingCode,
    manageToken: createBookingToken(appointmentId, bookingCode),
  };
}
