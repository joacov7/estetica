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

export interface Recipient {
  id: string;
  name: string;
  email: string;
}

/**
 * Resolve the recipients of a segment: clients with an email who have not
 * opted out of marketing, filtered by the segment rule.
 */
export async function resolveRecipients(orgId: string, segment: Segment): Promise<Recipient[]> {
  const [base, attended, settings] = await Promise.all([
    db
      .select({
        id: clients.id,
        name: clients.name,
        email: clients.email,
        birthday: clients.birthday,
      })
      .from(clients)
      .where(
        and(
          eq(clients.organizationId, orgId),
          isNotNull(clients.email),
          eq(clients.marketingOptOut, false),
        ),
      ),
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

  const withEmail = base.filter((c): c is Recipient & { birthday: string | null } =>
    Boolean(c.email && c.email.includes("@")),
  );

  let filtered = withEmail;
  if (segment === "inactive") {
    filtered = withEmail.filter((c) => (lastVisit.get(c.id) ?? 0) < cutoff);
  } else if (segment === "birthday_month") {
    filtered = withEmail.filter((c) => {
      if (!c.birthday) return false;
      const m = Number(c.birthday.slice(5, 7)); // "YYYY-MM-DD"
      return m === month;
    });
  }

  return filtered.map((c) => ({ id: c.id, name: c.name, email: c.email }));
}

/** Recipient counts for every segment (for the compose UI). */
export async function segmentCounts(orgId: string): Promise<Record<Segment, number>> {
  const [all, inactive, birthday] = await Promise.all([
    resolveRecipients(orgId, "all"),
    resolveRecipients(orgId, "inactive"),
    resolveRecipients(orgId, "birthday_month"),
  ]);
  return { all: all.length, inactive: inactive.length, birthday_month: birthday.length };
}
