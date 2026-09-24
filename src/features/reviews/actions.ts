"use server";

import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations, appointments, clients, reviews } from "@/db/schema";
import { getOrgSettings } from "@/lib/settings";
import { verifyBookingToken } from "@/lib/booking-token";
import { reviewLimiter, clientIp } from "@/lib/rate-limit";
import { verifyCaptcha } from "@/lib/captcha";

export type ReviewResult =
  | { ok: true; published: boolean }
  | { ok: false; error: string };

/**
 * Public review submission. Anonymous reviews land as "pending" (admin
 * approves before they show publicly). A valid appointment token (from a
 * review-request email) links the review to the client and publishes it.
 */
export async function submitReview(input: {
  slug: string;
  rating: number;
  comment?: string;
  name?: string;
  token?: string;
  captchaToken?: string;
}): Promise<ReviewResult> {
  const rating = Math.round(Number(input.rating));
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: "Elegí una puntuación de 1 a 5." };
  }
  const comment = (input.comment ?? "").trim().slice(0, 1000) || null;

  const ip = clientIp(await headers());
  const limited = await reviewLimiter.check(ip);
  if (!limited.ok) return { ok: false, error: "Demasiadas opiniones seguidas. Probá más tarde." };

  const captchaOk = await verifyCaptcha(input.captchaToken, ip);
  if (!captchaOk) return { ok: false, error: "No pudimos verificar que sos una persona. Recargá e intentá de nuevo." };

  const [org] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, input.slug))
    .limit(1);
  if (!org) return { ok: false, error: "Negocio no encontrado." };

  const settings = await getOrgSettings(org.id);
  if (!settings.reviewsEnabled) return { ok: false, error: "Las opiniones no están habilitadas." };

  // Verified review via appointment token → publish and link to the client.
  let clientId: string | null = null;
  let appointmentId: string | null = null;
  let verifiedName: string | null = null;
  if (input.token) {
    const tok = verifyBookingToken(input.token);
    if (tok) {
      const [appt] = await db
        .select({ id: appointments.id, clientId: appointments.clientId, orgId: appointments.organizationId })
        .from(appointments)
        .where(and(eq(appointments.id, tok.appointmentId), eq(appointments.bookingCode, tok.bookingCode)))
        .limit(1);
      if (appt && appt.orgId === org.id) {
        appointmentId = appt.id;
        clientId = appt.clientId;
        // One review per appointment.
        const [dupe] = await db
          .select({ id: reviews.id })
          .from(reviews)
          .where(and(eq(reviews.organizationId, org.id), eq(reviews.appointmentId, appt.id)))
          .limit(1);
        if (dupe) return { ok: false, error: "Ya dejaste tu opinión de este turno. ¡Gracias!" };
        if (clientId) {
          const [c] = await db.select({ name: clients.name }).from(clients).where(eq(clients.id, clientId)).limit(1);
          verifiedName = c?.name ?? null;
        }
      }
    }
  }

  const authorName = (verifiedName || (input.name ?? "").trim() || "Anónima").slice(0, 80);
  const verified = appointmentId !== null;

  await db.insert(reviews).values({
    organizationId: org.id,
    clientId,
    appointmentId,
    authorName,
    rating,
    comment,
    status: verified ? "published" : "pending",
  });

  return { ok: true, published: verified };
}
