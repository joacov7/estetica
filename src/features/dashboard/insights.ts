import "server-only";
import { formatInTimeZone } from "date-fns-tz";
import { and, count, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { clients, appointments, reviews } from "@/db/schema";
import { getOrgSettings } from "@/lib/settings";
import { waLink } from "@/lib/whatsapp";

const DAY = 24 * 60 * 60 * 1000;

export interface ContactSuggestion {
  id: string;
  name: string;
  detail: string;
  waUrl: string | null;
}

export interface DashboardInsights {
  pendingReviews: number;
  birthdays: ContactSuggestion[];
  inactive: ContactSuggestion[];
  inactiveTotal: number;
}

/**
 * Actionable weekly insights for the dashboard home: reviews awaiting
 * moderation, upcoming birthdays and clients to win back — each birthday and
 * win-back suggestion carries a ready-to-send WhatsApp link.
 */
export async function getDashboardInsights(
  orgId: string,
  orgName: string,
  timezone: string,
): Promise<DashboardInsights> {
  const settings = await getOrgSettings(orgId);
  const cc = settings.whatsappCountryCode;
  const now = Date.now();

  const [[pending], clientRows, attended] = await Promise.all([
    db.select({ c: count() }).from(reviews).where(and(eq(reviews.organizationId, orgId), eq(reviews.status, "pending"))),
    db
      .select({ id: clients.id, name: clients.name, phone: clients.phone, birthday: clients.birthday, optOut: clients.marketingOptOut })
      .from(clients)
      .where(eq(clients.organizationId, orgId)),
    db
      .select({ clientId: appointments.clientId, startAt: appointments.startAt })
      .from(appointments)
      .where(and(eq(appointments.organizationId, orgId), eq(appointments.status, "atendido"), isNotNull(appointments.clientId))),
  ]);

  // --- birthdays in the next 7 days (by MM-dd, org timezone) ---------------
  const upcoming = new Map<string, string>(); // MM-dd -> dd/MM label
  for (let i = 0; i < 7; i++) {
    const d = new Date(now + i * DAY);
    upcoming.set(formatInTimeZone(d, timezone, "MM-dd"), formatInTimeZone(d, timezone, "dd/MM"));
  }
  const birthdays: ContactSuggestion[] = clientRows
    .filter((c) => c.birthday && upcoming.has(c.birthday.slice(5)))
    .sort((a, b) => (a.birthday!.slice(5) < b.birthday!.slice(5) ? -1 : 1))
    .slice(0, 12)
    .map((c) => {
      const label = upcoming.get(c.birthday!.slice(5))!;
      const msg = `¡Hola ${c.name.split(" ")[0]}! 🎂 De parte de todo ${orgName} te deseamos un muy feliz cumple 💕`;
      return { id: c.id, name: c.name, detail: `🎂 ${label}`, waUrl: waLink(c.phone, msg, cc) };
    });

  // --- win-back: visited before, but not within the follow-up window -------
  const lastVisit = new Map<string, number>();
  for (const a of attended) {
    if (!a.clientId) continue;
    const t = new Date(a.startAt).getTime();
    if (t > (lastVisit.get(a.clientId) ?? 0)) lastVisit.set(a.clientId, t);
  }
  const cutoff = now - settings.followUpDays * DAY;
  const inactiveAll = clientRows
    .filter((c) => !c.optOut)
    .map((c) => ({ c, lv: lastVisit.get(c.id) ?? 0 }))
    .filter((x) => x.lv > 0 && x.lv < cutoff)
    .sort((a, b) => a.lv - b.lv); // longest-gone first

  const inactive: ContactSuggestion[] = inactiveAll.slice(0, 12).map(({ c, lv }) => {
    const days = Math.round((now - lv) / DAY);
    const msg = `¡Hola ${c.name.split(" ")[0]}! Hace un tiempo que no te vemos por ${orgName} 💅 ¿Reservamos tu próximo turno?`;
    return { id: c.id, name: c.name, detail: `hace ${days} días`, waUrl: waLink(c.phone, msg, cc) };
  });

  return {
    pendingReviews: pending.c,
    birthdays,
    inactive,
    inactiveTotal: inactiveAll.length,
  };
}
