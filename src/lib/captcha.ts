import "server-only";

/**
 * Cloudflare Turnstile verification (bot protection for public booking).
 *
 * Graceful: if TURNSTILE_SECRET_KEY is not configured, verification is skipped
 * (returns true) so the app works without it. When configured, a valid token is
 * required. The public site key lives in NEXT_PUBLIC_TURNSTILE_SITE_KEY.
 */
const SECRET = process.env.TURNSTILE_SECRET_KEY;

export const captchaEnabled = Boolean(SECRET);

export async function verifyCaptcha(token: string | undefined, ip: string): Promise<boolean> {
  if (!SECRET) return true; // not configured → skip
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: SECRET, response: token, remoteip: ip }),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false; // fail closed when configured
  }
}
