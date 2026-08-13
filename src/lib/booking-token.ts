import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed tokens that let a client manage (view/cancel/reschedule) their own
 * appointment without an account. The token binds the appointment id and its
 * booking code, signed with a server secret — unguessable and tamper-proof.
 */
function secret(): string {
  const s = process.env.BOOKING_TOKEN_SECRET;
  if (!s) throw new Error("Missing BOOKING_TOKEN_SECRET");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createBookingToken(appointmentId: string, bookingCode: string): string {
  const payload = `${appointmentId}.${bookingCode}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyBookingToken(
  token: string,
): { appointmentId: string; bookingCode: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [appointmentId, bookingCode, sig] = parts;
  const expected = sign(`${appointmentId}.${bookingCode}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { appointmentId, bookingCode };
}
