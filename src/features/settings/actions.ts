"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { organizations, reservedSlugs, businessHours, settings } from "@/db/schema";
import { getCurrentOrg } from "@/features/org/current";
import { getOrgSettings } from "@/lib/settings";
import {
  orgProfileSchema,
  businessHoursSchema,
  bookingSettingsSchema,
  reminderSettingsSchema,
  type OrgProfileInput,
  type BusinessHoursInput,
  type BookingSettingsInput,
  type ReminderSettingsInput,
} from "@/lib/validations/org";

const WRITE_ROLES = ["owner", "admin"];

export async function updateOrgProfile(input: OrgProfileInput) {
  const parsed = orgProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { org, role } = await getCurrentOrg();
  if (!org || !role || !WRITE_ROLES.includes(role)) {
    return { ok: false as const, error: "No autorizado" };
  }
  const v = parsed.data;

  if (v.slug !== org.slug) {
    const [reserved] = await db.select().from(reservedSlugs).where(eq(reservedSlugs.slug, v.slug)).limit(1);
    if (reserved) return { ok: false as const, error: "Ese link no está disponible." };
    const [taken] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(and(eq(organizations.slug, v.slug), ne(organizations.id, org.id)))
      .limit(1);
    if (taken) return { ok: false as const, error: "Ese link ya está en uso." };
  }

  await db
    .update(organizations)
    .set({
      name: v.name,
      slug: v.slug,
      description: v.description || null,
      address: v.address || null,
      instagram: v.instagram || null,
      whatsapp: v.whatsapp || null,
      timezone: v.timezone,
      currency: v.currency.toUpperCase(),
      locale: v.locale,
    })
    .where(eq(organizations.id, org.id));

  revalidatePath("/dashboard/configuracion");
  revalidatePath(`/${v.slug}`);
  return { ok: true as const };
}

export async function updateBookingSettings(input: BookingSettingsInput) {
  const parsed = bookingSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { org, role } = await getCurrentOrg();
  if (!org || !role || !WRITE_ROLES.includes(role)) {
    return { ok: false as const, error: "No autorizado" };
  }

  // Merge into existing settings.data so other keys are preserved.
  const current = await getOrgSettings(org.id);
  const data = { ...current, ...parsed.data };
  await db
    .insert(settings)
    .values({ organizationId: org.id, data })
    .onConflictDoUpdate({ target: settings.organizationId, set: { data } });

  revalidatePath("/dashboard/configuracion");
  return { ok: true as const };
}

export async function updateReminderSettings(input: ReminderSettingsInput) {
  const parsed = reminderSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { org, role } = await getCurrentOrg();
  if (!org || !role || !WRITE_ROLES.includes(role)) {
    return { ok: false as const, error: "No autorizado" };
  }
  const current = await getOrgSettings(org.id);
  const data = { ...current, ...parsed.data };
  await db
    .insert(settings)
    .values({ organizationId: org.id, data })
    .onConflictDoUpdate({ target: settings.organizationId, set: { data } });

  revalidatePath("/dashboard/configuracion");
  return { ok: true as const };
}

export async function updateBusinessHours(input: BusinessHoursInput) {
  const parsed = businessHoursSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Horarios inválidos" };

  const { org, role } = await getCurrentOrg();
  if (!org || !role || !WRITE_ROLES.includes(role)) {
    return { ok: false as const, error: "No autorizado" };
  }

  for (const h of parsed.data.hours) {
    if (h.enabled && h.endTime <= h.startTime) {
      return { ok: false as const, error: "El cierre debe ser posterior a la apertura." };
    }
  }

  // Replace the organization-level weekly hours (professional_id IS NULL).
  await db.transaction(async (tx) => {
    await tx
      .delete(businessHours)
      .where(and(eq(businessHours.organizationId, org.id), isNull(businessHours.professionalId)));

    const rows = parsed.data.hours
      .filter((h) => h.enabled)
      .map((h) => ({
        organizationId: org.id,
        professionalId: null,
        weekday: h.weekday,
        startTime: h.startTime,
        endTime: h.endTime,
      }));
    if (rows.length > 0) await tx.insert(businessHours).values(rows);
  });

  revalidatePath("/dashboard/configuracion");
  return { ok: true as const };
}
