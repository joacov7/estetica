import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";

/**
 * Per-organization, admin-configurable settings, stored in settings.data (jsonb).
 * Everything here has a sensible default so the app works before it's touched.
 */
export interface OrgSettings {
  /** How many days ahead a client can book. */
  advanceDays: number;
  /** Minimum minutes between "now" and a bookable slot (today only). */
  leadTimeMinutes: number;
  /** Client can cancel/reschedule for free up to this many hours before. */
  cancellationWindowHours: number;
  /** Send an automatic email reminder before the appointment. */
  emailReminderEnabled: boolean;
  /** How many hours before the appointment the reminder is sent. */
  reminderHoursAhead: number;
}

export const DEFAULT_SETTINGS: OrgSettings = {
  advanceDays: 21,
  leadTimeMinutes: 60,
  cancellationWindowHours: 24,
  emailReminderEnabled: true,
  reminderHoursAhead: 24,
};

export async function getOrgSettings(organizationId: string): Promise<OrgSettings> {
  const [row] = await db
    .select({ data: settings.data })
    .from(settings)
    .where(eq(settings.organizationId, organizationId))
    .limit(1);
  return { ...DEFAULT_SETTINGS, ...((row?.data as Partial<OrgSettings>) ?? {}) };
}
