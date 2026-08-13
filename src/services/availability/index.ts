import "server-only";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeDaySlots, type Interval } from "./core";

const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_STATUSES = ["reservado", "confirmado", "atendido"] as const;

export interface AvailableSlot {
  /** UTC ISO instant of the slot start. */
  startIso: string;
  /** Wall-clock label in the organization timezone, e.g. "14:30". */
  label: string;
}

export interface AvailabilityParams {
  organizationId: string;
  professionalId: string;
  /** Calendar date in the org timezone, "YYYY-MM-DD". */
  date: string;
  /** Services requested (their duration + buffer sum defines the slot length). */
  serviceIds: string[];
  timezone: string;
  /** Grid granularity for candidate starts, in minutes. */
  step?: number;
  /** Minimum minutes from now before a slot can be booked (today only). */
  leadMinutes?: number;
}

/** UTC instant of local midnight for the given calendar date + timezone. */
function localMidnightUtc(date: string, timezone: string): Date {
  return fromZonedTime(`${date}T00:00:00`, timezone);
}

/** Weekday (0=Sun..6=Sat) of a "YYYY-MM-DD" calendar date. */
function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Convert a UTC instant to minutes-from-local-midnight, clamped to [0, 1440]. */
function toDayMinutes(instant: Date, dayRef: Date): number {
  const mins = (instant.getTime() - dayRef.getTime()) / 60000;
  return Math.max(0, Math.min(1440, mins));
}

/**
 * Compute the bookable slot starts for one professional on one day.
 * Runs server-side with the service role: it must read every appointment/block
 * to avoid conflicts, then returns only free slots to the caller.
 */
export async function getAvailableSlots(
  params: AvailabilityParams,
): Promise<AvailableSlot[]> {
  const {
    organizationId,
    professionalId,
    date,
    serviceIds,
    timezone,
    step = 30,
    leadMinutes = 60,
  } = params;

  if (serviceIds.length === 0) return [];

  const db = createAdminClient();
  const dayRef = localMidnightUtc(date, timezone);
  const dayEnd = new Date(dayRef.getTime() + DAY_MS);
  const weekday = weekdayOf(date);

  // --- slot length = sum(duration + buffer) of requested services ----------
  const { data: services, error: svcErr } = await db
    .from("services")
    .select("id, duration_min, buffer_min")
    .eq("organization_id", organizationId)
    .in("id", serviceIds);
  if (svcErr) throw svcErr;
  if (!services || services.length === 0) return [];

  const slotLength = services.reduce(
    (sum, s) => sum + s.duration_min + s.buffer_min,
    0,
  );

  // --- working windows for this professional / weekday ---------------------
  const { data: hours, error: hoursErr } = await db
    .from("business_hours")
    .select("professional_id, weekday, start_time, end_time")
    .eq("organization_id", organizationId)
    .eq("weekday", weekday);
  if (hoursErr) throw hoursErr;

  const own = (hours ?? []).filter((h) => h.professional_id === professionalId);
  const orgDefault = (hours ?? []).filter((h) => h.professional_id === null);
  const applicable = own.length > 0 ? own : orgDefault;

  const workWindows: Interval[] = applicable.map((h) => ({
    start: timeToMinutes(h.start_time),
    end: timeToMinutes(h.end_time),
  }));
  if (workWindows.length === 0) return [];

  // --- busy: existing appointments -----------------------------------------
  const { data: appts, error: apptErr } = await db
    .from("appointments")
    .select("start_at, end_at, status")
    .eq("professional_id", professionalId)
    .in("status", [...ACTIVE_STATUSES])
    .lt("start_at", dayEnd.toISOString())
    .gt("end_at", dayRef.toISOString());
  if (apptErr) throw apptErr;

  // --- busy: blocked times (professional-specific + shop-wide) --------------
  const { data: blocks, error: blockErr } = await db
    .from("blocked_times")
    .select("professional_id, start_at, end_at")
    .eq("organization_id", organizationId)
    .lt("start_at", dayEnd.toISOString())
    .gt("end_at", dayRef.toISOString());
  if (blockErr) throw blockErr;

  const busy: Interval[] = [
    ...(appts ?? []).map((a) => ({
      start: toDayMinutes(new Date(a.start_at), dayRef),
      end: toDayMinutes(new Date(a.end_at), dayRef),
    })),
    ...(blocks ?? [])
      .filter((b) => b.professional_id === null || b.professional_id === professionalId)
      .map((b) => ({
        start: toDayMinutes(new Date(b.start_at), dayRef),
        end: toDayMinutes(new Date(b.end_at), dayRef),
      })),
  ];

  // --- lead time: don't offer past/too-soon slots today --------------------
  const nowMinutes = (Date.now() - dayRef.getTime()) / 60000;
  const isToday = nowMinutes >= 0 && nowMinutes < 1440;
  const earliestStart = isToday ? Math.ceil(nowMinutes + leadMinutes) : 0;

  const startMinutes = computeDaySlots({
    workWindows,
    busy,
    slotLength,
    step,
    earliestStart,
  });

  return startMinutes.map((m) => {
    const startIso = new Date(dayRef.getTime() + m * 60000).toISOString();
    return { startIso, label: formatInTimeZone(startIso, timezone, "HH:mm") };
  });
}

/** "HH:MM[:SS]" → minutes from midnight. */
function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Total slot length (minutes) for a set of services. Exported for reuse. */
export function totalSlotLength(
  services: { duration_min: number; buffer_min: number }[],
): number {
  return services.reduce((s, x) => s + x.duration_min + x.buffer_min, 0);
}
