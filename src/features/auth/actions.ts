"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { signIn } from "@/auth";
import { loginLimiter, signupLimiter, clientIp } from "@/lib/rate-limit";
import { db } from "@/db";
import { users, organizations, organizationMembers, settings, businessHours } from "@/db/schema";
import { reservedSlugs } from "@/db/schema";
import { signupSchema, slugify, type SignupInput } from "@/lib/validations/auth";
import { createResetToken, parseResetToken, verifyResetToken } from "@/lib/reset-token";
import { emailConfigured, sendEmail, resetEmailHtml } from "@/services/notifications/email";

/** Login form action (useActionState). Returns an error string or redirects.
 *  Uses redirect:false + a relative redirect so it never depends on AUTH_URL
 *  (works on any Vercel domain / preview). */
export async function login(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const ip = clientIp(await headers());
  const limited = await loginLimiter.check(`login:${ip}`);
  if (!limited.ok) return "Demasiados intentos. Esperá unos minutos.";

  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) return "Email o contraseña incorrectos.";
    throw error;
  }
  redirect("/dashboard"); // relative → stays on the current host
}

/** Request a reset link. Always reports success (no email enumeration). */
export async function requestPasswordReset(
  email: string,
): Promise<{ sent: true; emailConfigured: boolean }> {
  const ip = clientIp(await headers());
  const limited = await loginLimiter.check(`reset:${ip}`);
  const e = String(email || "").toLowerCase().trim();

  if (limited.ok && e) {
    const [user] = await db.select().from(users).where(eq(users.email, e)).limit(1);
    if (user) {
      const token = createResetToken(user.id, user.passwordHash);
      const site = process.env.NEXT_PUBLIC_SITE_URL || "";
      const url = `${site}/restablecer/${token}`;
      await sendEmail({
        to: user.email,
        subject: "Restablecer tu contraseña",
        html: resetEmailHtml({ name: user.name, url }),
      });
    }
  }
  return { sent: true, emailConfigured };
}

/** Complete the reset with a token + new password. */
export async function resetPassword(
  token: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (String(password).length < 8) return { ok: false, error: "Mínimo 8 caracteres" };
  const parsed = parseResetToken(token);
  if (!parsed) return { ok: false, error: "Enlace inválido o vencido." };

  const [user] = await db.select().from(users).where(eq(users.id, parsed.userId)).limit(1);
  if (!user || !verifyResetToken(parsed, user.passwordHash)) {
    return { ok: false, error: "Enlace inválido o vencido." };
  }

  const passwordHash = await bcrypt.hash(String(password), 10);
  await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));
  return { ok: true };
}

/** Find a free slug derived from the business name. */
async function resolveSlug(orgName: string): Promise<string> {
  const base = slugify(orgName) || "negocio";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const [reserved] = await db.select().from(reservedSlugs).where(eq(reservedSlugs.slug, candidate)).limit(1);
    if (reserved) continue;
    const [taken] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, candidate)).limit(1);
    if (!taken) return candidate;
  }
  return `${base}-${Date.now()}`;
}

export type SignupResult = { ok: false; error: string } | never;

/** Create the user + organization + owner membership, then sign in. */
export async function signup(input: SignupInput): Promise<SignupResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const ip = clientIp(await headers());
  const limited = await signupLimiter.check(`signup:${ip}`);
  if (!limited.ok) return { ok: false, error: "Demasiados intentos. Esperá unos minutos." };

  const v = parsed.data;

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, v.email)).limit(1);
  if (existing) return { ok: false, error: "Ese email ya está registrado." };

  const slug = await resolveSlug(v.orgName);
  const passwordHash = await bcrypt.hash(v.password, 10);

  await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ email: v.email, name: v.name, passwordHash })
      .returning({ id: users.id });

    const [org] = await tx
      .insert(organizations)
      .values({ slug, name: v.orgName })
      .returning({ id: organizations.id });

    await tx.insert(organizationMembers).values({
      organizationId: org.id,
      userId: user.id,
      role: "owner",
    });
    await tx.insert(settings).values({ organizationId: org.id });

    // Sensible default opening hours: Tue–Sat 10:00–19:00.
    await tx.insert(businessHours).values(
      [2, 3, 4, 5, 6].map((weekday) => ({
        organizationId: org.id,
        professionalId: null,
        weekday,
        startTime: "10:00",
        endTime: "19:00",
      })),
    );
  });

  try {
    await signIn("credentials", { email: v.email, password: v.password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: "No pudimos iniciar sesión." };
    throw error;
  }
  redirect("/dashboard"); // relative → stays on the current host
}
