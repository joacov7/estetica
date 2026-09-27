import "server-only";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { clients, appointments } from "@/db/schema";
import { getOrgSettings } from "@/lib/settings";

export type Segment = "all" | "inactive" | "birthday_month";

export const SEGMENT_LABEL: Record<Segment, string> = {
  all: "Todas las clientas",
  inactive: "Clientas que hace tiempo no vienen",
  birthday_month: "Cumpleañeras del mes",
};

export type Channel = "email" | "whatsapp";

export interface Recipient {
  id: string;
  name: string;
  email: string;
  phone: string;
}

/**
 * Resolve the recipients of a segment: clients who have not opted out of
 * marketing and have the contact field required by the channel (email for
 * email, phone for WhatsApp), filtered by the segment rule.
 */
export async function resolveRecipients(
  orgId: string,
  segment: Segment,
  channel: Channel = "email",
): Promise<Recipient[]> {
  const [base, attended, settings] = await Promise.all([
    db
      .select({
        id: clients.id,
        name: clients.name,
        email: clients.email,
        phone: clients.phone,
        birthday: clients.birthday,
      })
      .from(clients)
      .where(and(eq(clients.organizationId, orgId), eq(clients.marketingOptOut, false))),
    db
      .select({ clientId: appointments.clientId, startAt: appointments.startAt })
      .from(appointments)
      .where(and(eq(appointments.organizationId, orgId), eq(appointments.status, "atendido"))),
    getOrgSettings(orgId),
  ]);

  // last visit per client
  const lastVisit = new Map<string, number>();
  for (const a of attended) {
    if (!a.clientId) continue;
    const t = new Date(a.startAt).getTime();
    if (t > (lastVisit.get(a.clientId) ?? 0)) lastVisit.set(a.clientId, t);
  }

  const now = Date.now();
  const cutoff = now - settings.followUpDays * 24 * 60 * 60 * 1000;
  const month = new Date().getUTCMonth() + 1; // 1..12

  const reachable = base.filter((c) =>
    channel === "whatsapp" ? Boolean(c.phone) : Boolean(c.email && c.email.includes("@")),
  );

  let filtered = reachable;
  if (segment === "inactive") {
    filtered = reachable.filter((c) => (lastVisit.get(c.id) ?? 0) < cutoff);
  } else if (segment === "birthday_month") {
    filtered = reachable.filter((c) => {
      if (!c.birthday) return false;
      const m = Number(c.birthday.slice(5, 7)); // "YYYY-MM-DD"
      return m === month;
    });
  }

  return filtered.map((c) => ({ id: c.id, name: c.name, email: c.email ?? "", phone: c.phone }));
}

/** Recipient counts for every segment and channel (for the compose UI). */
export async function segmentCounts(
  orgId: string,
  channel: Channel = "email",
): Promise<Record<Segment, number>> {
  const [all, inactive, birthday] = await Promise.all([
    resolveRecipients(orgId, "all", channel),
    resolveRecipients(orgId, "inactive", channel),
    resolveRecipients(orgId, "birthday_month", channel),
  ]);
  return { all: all.length, inactive: inactive.length, birthday_month: birthday.length };
}
