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
  /** Supplies cost as a % of revenue (for the income statement). */
  insumosPct: number;
  /** Fixed monthly costs (rent, monotributo, services…) in cents. */
  monthlyFixedCents: number;

  // --- reviews & marketing --------------------------------------------------
  /** Accept client reviews and show published ones on the public page. */
  reviewsEnabled: boolean;
  /** Email a review request after an appointment is marked "atendido". */
  reviewRequestEnabled: boolean;
  /** Hours to wait after the appointment before asking for a review. */
  reviewRequestHoursAfter: number;
  /** Greet clients by email on their birthday. */
  birthdayGreetingEnabled: boolean;
  /** Birthday message body (plain text). Empty → a friendly default is used. */
  birthdayGreetingText: string;
  /** Win-back: email clients who haven't visited in a while. */
  followUpEnabled: boolean;
  /** Days since last visit before a win-back email is sent. */
  followUpDays: number;
  /** Win-back message body (plain text). Empty → a friendly default is used. */
  followUpText: string;

  // --- channels & integrations ---------------------------------------------
  /** Country/dialing code prepended to client phones for WhatsApp links (AR mobiles: "549"). */
  whatsappCountryCode: string;
  /** Google "write a review" link (funnels happy clients to Google). */
  googleReviewUrl: string;
  /** Google Business profile link ("ver en Google"). */
  googlePlaceUrl: string;
  /** Manually-entered Google rating to show on the page (0 = hidden). */
  googleRating: number;
  /** Manually-entered Google review count to show on the page. */
  googleReviewCount: number;
}

export const DEFAULT_SETTINGS: OrgSettings = {
  advanceDays: 21,
  leadTimeMinutes: 60,
  cancellationWindowHours: 24,
  emailReminderEnabled: true,
  reminderHoursAhead: 24,
  insumosPct: 0,
  monthlyFixedCents: 0,
  reviewsEnabled: true,
  reviewRequestEnabled: false,
  reviewRequestHoursAfter: 3,
  birthdayGreetingEnabled: false,
  birthdayGreetingText: "",
  followUpEnabled: false,
  followUpDays: 45,
  followUpText: "",
  whatsappCountryCode: "549",
  googleReviewUrl: "",
  googlePlaceUrl: "",
  googleRating: 0,
  googleReviewCount: 0,
};

export async function getOrgSettings(organizationId: string): Promise<OrgSettings> {
  const [row] = await db
    .select({ data: settings.data })
    .from(settings)
    .where(eq(settings.organizationId, organizationId))
    .limit(1);
  return { ...DEFAULT_SETTINGS, ...((row?.data as Partial<OrgSettings>) ?? {}) };
}
