import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stateless password-reset tokens. Signed with a secret mixed with the user's
 * current password hash, so a token becomes invalid the moment the password
 * changes (single-use) — and it also carries an expiry. No tokens are stored.
 */
const TTL_MS = 60 * 60 * 1000; // 1 hour

function secret(): string {
  const s = process.env.BOOKING_TOKEN_SECRET;
  if (!s) throw new Error("Missing BOOKING_TOKEN_SECRET");
  return s;
}

function sign(payload: string, passwordHash: string): string {
  return createHmac("sha256", secret() + passwordHash).update(payload).digest("base64url");
}

export function createResetToken(userId: string, passwordHash: string): string {
  const exp = Date.now() + TTL_MS;
  const payload = `${userId}.${exp}`;
  return `${payload}.${sign(payload, passwordHash)}`;
}

export interface ParsedResetToken {
  userId: string;
  exp: number;
  sig: string;
}

export function parseResetToken(token: string): ParsedResetToken | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!userId || !Number.isFinite(exp) || !sig) return null;
  return { userId, exp, sig };
}

export function verifyResetToken(parsed: ParsedResetToken, passwordHash: string): boolean {
  if (Date.now() > parsed.exp) return false;
  const expected = sign(`${parsed.userId}.${parsed.exp}`, passwordHash);
  const a = Buffer.from(parsed.sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
