import "server-only";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { and, eq, gt, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import { services, businessHours, appointments, blockedTimes } from "@/db/schema";
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
  serviceIds: string[];
  timezone: string;
  step?: number;
  leadMinutes?: number;
}

function localMidnightUtc(date: string, timezone: string): Date {
  return fromZonedTime(`${date}T00:00:00`, timezone);
}

function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function toDayMinutes(instant: Date, dayRef: Date): number {
  const mins = (instant.getTime() - dayRef.getTime()) / 60000;
  return Math.max(0, Math.min(1440, mins));
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Compute the bookable slot starts for one professional on one day.
 * Reads every appointment/block to avoid conflicts, then returns only free
 * slots. The DB exclusion constraint remains the hard guarantee at write time.
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

  const dayRef = localMidnightUtc(date, timezone);
  const dayEnd = new Date(dayRef.getTime() + DAY_MS);
  const dayRefIso = dayRef.toISOString();
  const dayEndIso = dayEnd.toISOString();
  const weekday = weekdayOf(date);

  const [svc, hours, appts, blocks] = await Promise.all([
    db
      .select({ durationMin: services.durationMin, bufferMin: services.bufferMin })
      .from(services)
      .where(and(eq(services.organizationId, organizationId), inArray(services.id, serviceIds))),
    db
      .select({
        professionalId: businessHours.professionalId,
        startTime: businessHours.startTime,
        endTime: businessHours.endTime,
      })
      .from(businessHours)
      .where(and(eq(businessHours.organizationId, organizationId), eq(businessHours.weekday, weekday))),
    db
      .select({ startAt: appointments.startAt, endAt: appointments.endAt })
      .from(appointments)
      .where(
        and(
          eq(appointments.professionalId, professionalId),
          inArray(appointments.status, [...ACTIVE_STATUSES]),
          lt(appointments.startAt, dayEndIso),
          gt(appointments.endAt, dayRefIso),
        ),
      ),
    db
      .select({
        professionalId: blockedTimes.professionalId,
        startAt: blockedTimes.startAt,
        endAt: blockedTimes.endAt,
      })
      .from(blockedTimes)
      .where(
        and(
          eq(blockedTimes.organizationId, organizationId),
          lt(blockedTimes.startAt, dayEndIso),
          gt(blockedTimes.endAt, dayRefIso),
        ),
      ),
  ]);

  if (svc.length === 0) return [];
  const slotLength = svc.reduce((s, x) => s + x.durationMin + x.bufferMin, 0);

  const own = hours.filter((h) => h.professionalId === professionalId);
  const orgDefault = hours.filter((h) => h.professionalId === null);
  const applicable = own.length > 0 ? own : orgDefault;

  const workWindows: Interval[] = applicable.map((h) => ({
    start: timeToMinutes(h.startTime),
    end: timeToMinutes(h.endTime),
  }));
  if (workWindows.length === 0) return [];

  const busy: Interval[] = [
    ...appts.map((a) => ({
      start: toDayMinutes(new Date(a.startAt), dayRef),
      end: toDayMinutes(new Date(a.endAt), dayRef),
    })),
    ...blocks
      .filter((b) => b.professionalId === null || b.professionalId === professionalId)
      .map((b) => ({
        start: toDayMinutes(new Date(b.startAt), dayRef),
        end: toDayMinutes(new Date(b.endAt), dayRef),
      })),
  ];

  const nowMinutes = (Date.now() - dayRef.getTime()) / 60000;
  const isToday = nowMinutes >= 0 && nowMinutes < 1440;
  const earliestStart = isToday ? Math.ceil(nowMinutes + leadMinutes) : 0;

  const startMinutes = computeDaySlots({ workWindows, busy, slotLength, step, earliestStart });

  return startMinutes.map((m) => {
    const startIso = new Date(dayRef.getTime() + m * 60000).toISOString();
    return { startIso, label: formatInTimeZone(startIso, timezone, "HH:mm") };
  });
}

export function totalSlotLength(
  svcs: { duration_min: number; buffer_min: number }[],
): number {
  return svcs.reduce((s, x) => s + x.duration_min + x.buffer_min, 0);
}
