import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed, stateless unsubscribe tokens. Binds a client id, signed with the
 * server secret so it can't be forged. Reuses BOOKING_TOKEN_SECRET to avoid a
 * new env var — the payload namespace ("mkt") keeps it distinct.
 */
function secret(): string {
  const s = process.env.BOOKING_TOKEN_SECRET;
  if (!s) throw new Error("Missing BOOKING_TOKEN_SECRET");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createUnsubscribeToken(clientId: string): string {
  const payload = `mkt.${clientId}`;
  return `${clientId}.${sign(payload)}`;
}

export function verifyUnsubscribeToken(token: string): { clientId: string } | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [clientId, sig] = parts;
  const expected = sign(`mkt.${clientId}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { clientId };
}
