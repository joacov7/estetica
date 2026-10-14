/**
 * Shared helpers for appointment booking: a short human-friendly code and a
 * Postgres SQLSTATE extractor. Used by both the public and the admin booking
 * flows (features/booking, features/agenda).
 */

// Ambiguous characters (0/O, 1/I) removed so codes are easy to read aloud.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateBookingCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return code;
}

/** Extract a Postgres SQLSTATE code from a thrown error (postgres.js / drizzle). */
export function pgCode(e: unknown): string | undefined {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code ?? err?.cause?.code;
}
