import "server-only";
import { and, eq } from "drizzle-orm";
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

type ClientRow = { id: string; name: string; email: string | null; phone: string; birthday: string | null };

interface SegmentData {
  clients: ClientRow[];
  lastVisit: Map<string, number>;
  cutoffMs: number;
  month: number;
}

/**
 * Load the raw data needed to resolve any segment, once. Both the send path
 * and the compose-UI counts build on this so a single page render hits the DB
 * once instead of per segment/channel.
 */
async function loadSegmentData(orgId: string): Promise<SegmentData> {
  const [base, attended, settings] = await Promise.all([
    db
      .select({ id: clients.id, name: clients.name, email: clients.email, phone: clients.phone, birthday: clients.birthday })
      .from(clients)
      .where(and(eq(clients.organizationId, orgId), eq(clients.marketingOptOut, false))),
    db
      .select({ clientId: appointments.clientId, startAt: appointments.startAt })
      .from(appointments)
      .where(and(eq(appointments.organizationId, orgId), eq(appointments.status, "atendido"))),
    getOrgSettings(orgId),
  ]);

  const lastVisit = new Map<string, number>();
  for (const a of attended) {
    if (!a.clientId) continue;
    const t = new Date(a.startAt).getTime();
    if (t > (lastVisit.get(a.clientId) ?? 0)) lastVisit.set(a.clientId, t);
  }

  return {
    clients: base,
    lastVisit,
    cutoffMs: Date.now() - settings.followUpDays * 24 * 60 * 60 * 1000,
    month: new Date().getUTCMonth() + 1,
  };
}

/** Pure segment+channel filter over pre-loaded data. */
function filterSegment(data: SegmentData, segment: Segment, channel: Channel): Recipient[] {
  const reachable = data.clients.filter((c) =>
    channel === "whatsapp" ? Boolean(c.phone) : Boolean(c.email && c.email.includes("@")),
  );
  const filtered =
    segment === "inactive"
      ? reachable.filter((c) => (data.lastVisit.get(c.id) ?? 0) < data.cutoffMs)
      : segment === "birthday_month"
        ? reachable.filter((c) => c.birthday != null && Number(c.birthday.slice(5, 7)) === data.month)
        : reachable;
  return filtered.map((c) => ({ id: c.id, name: c.name, email: c.email ?? "", phone: c.phone }));
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
  return filterSegment(await loadSegmentData(orgId), segment, channel);
}

const SEGMENTS: Segment[] = ["all", "inactive", "birthday_month"];
const countBy = (data: SegmentData, channel: Channel): Record<Segment, number> =>
  Object.fromEntries(SEGMENTS.map((s) => [s, filterSegment(data, s, channel).length])) as Record<Segment, number>;

/** Recipient counts per segment for both channels, loading the data only once. */
export async function segmentCountsByChannel(
  orgId: string,
): Promise<{ email: Record<Segment, number>; whatsapp: Record<Segment, number> }> {
  const data = await loadSegmentData(orgId);
  return { email: countBy(data, "email"), whatsapp: countBy(data, "whatsapp") };
}
