import { NextResponse } from "next/server";
import { formatInTimeZone } from "date-fns-tz";
import { and, eq, gte, inArray, isNotNull, isNull, lt, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  organizations,
  clients,
  appointments,
  settings as settingsTable,
  notifications,
} from "@/db/schema";
import { DEFAULT_SETTINGS, type OrgSettings } from "@/lib/settings";
import {
  emailConfigured,
  sendEmail,
  birthdayEmailHtml,
  campaignEmailHtml,
  reviewRequestEmailHtml,
} from "@/services/notifications/email";
import { publicUrl } from "@/lib/site-url";
import { createBookingToken } from "@/lib/booking-token";
import { createUnsubscribeToken } from "@/lib/marketing-token";

export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;
const H = 60 * 60 * 1000;

/**
 * GET /api/cron/daily — daily marketing automations, all admin-toggled:
 *  - birthday greetings (once per year per client)
 *  - win-back follow-ups (once per follow-up window per client)
 *  - post-visit review requests (once per appointment)
 * Idempotent via the notifications table. Protected by CRON_SECRET.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!emailConfigured) {
    return NextResponse.json({ note: "email no configurado (falta RESEND_API_KEY)" });
  }

  const now = Date.now();

  // org id -> { name, slug, tz, settings }
  const orgRows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      tz: organizations.timezone,
      data: settingsTable.data,
    })
    .from(organizations)
    .leftJoin(settingsTable, eq(settingsTable.organizationId, organizations.id));

  const orgs = new Map(
    orgRows.map((o) => [
      o.id,
      { ...o, settings: { ...DEFAULT_SETTINGS, ...((o.data as Partial<OrgSettings>) ?? {}) } as OrgSettings },
    ]),
  );

  const result = { birthdays: 0, followups: 0, reviewRequests: 0 };

  // ---- 1) Birthday greetings ----------------------------------------------
  const bdayOrgIds = [...orgs.values()].filter((o) => o.settings.birthdayGreetingEnabled).map((o) => o.id);
  if (bdayOrgIds.length) {
    const cands = await db
      .select({ id: clients.id, name: clients.name, email: clients.email, birthday: clients.birthday, orgId: clients.organizationId })
      .from(clients)
      .where(
        and(
          inArray(clients.organizationId, bdayOrgIds),
          isNotNull(clients.email),
          isNotNull(clients.birthday),
          eq(clients.marketingOptOut, false),
        ),
      );

    // Today's MM-dd per org timezone.
    const todayByOrg = new Map(bdayOrgIds.map((id) => [id, formatInTimeZone(now, orgs.get(id)!.tz, "MM-dd")]));
    const due = cands.filter((c) => c.birthday!.slice(5) === todayByOrg.get(c.orgId));

    if (due.length) {
      // Dedup: skip clients already greeted this calendar year.
      const yearStart = new Date(new Date().getUTCFullYear(), 0, 1).toISOString();
      const already = await db
        .select({ clientId: notifications.clientId })
        .from(notifications)
        .where(
          and(
            eq(notifications.type, "birthday"),
            inArray(notifications.clientId, due.map((c) => c.id)),
            gte(notifications.sentAt, yearStart),
          ),
        );
      const greeted = new Set(already.map((a) => a.clientId));

      for (const c of due) {
        if (greeted.has(c.id)) continue;
        const org = orgs.get(c.orgId)!;
        const ok = await sendEmail({
          to: c.email!,
          subject: `¡Feliz cumple de parte de ${org.name}! 🎂`,
          html: birthdayEmailHtml({
            orgName: org.name,
            clientName: c.name,
            body: org.settings.birthdayGreetingText,
            ctaUrl: publicUrl(`/${org.slug}/reservar`),
          }),
        });
        if (ok) {
          await db.insert(notifications).values({
            organizationId: c.orgId,
            clientId: c.id,
            type: "birthday",
            channel: "email",
            sentAt: new Date().toISOString(),
          });
          result.birthdays++;
        }
      }
    }
  }

  // ---- 2) Win-back follow-ups ---------------------------------------------
  const fuOrgs = [...orgs.values()].filter((o) => o.settings.followUpEnabled);
  if (fuOrgs.length) {
    const fuOrgIds = fuOrgs.map((o) => o.id);
    const [cands, attended] = await Promise.all([
      db
        .select({ id: clients.id, name: clients.name, email: clients.email, orgId: clients.organizationId })
        .from(clients)
        .where(and(inArray(clients.organizationId, fuOrgIds), isNotNull(clients.email), eq(clients.marketingOptOut, false))),
      db
        .select({ clientId: appointments.clientId, startAt: appointments.startAt })
        .from(appointments)
        .where(and(inArray(appointments.organizationId, fuOrgIds), eq(appointments.status, "atendido"))),
    ]);

    const lastVisit = new Map<string, number>();
    for (const a of attended) {
      if (!a.clientId) continue;
      const t = new Date(a.startAt).getTime();
      if (t > (lastVisit.get(a.clientId) ?? 0)) lastVisit.set(a.clientId, t);
    }

    // Candidates: visited before, but not within their org's follow-up window.
    const due = cands.filter((c) => {
      const lv = lastVisit.get(c.id);
      if (!lv) return false;
      const days = orgs.get(c.orgId)!.settings.followUpDays;
      return lv < now - days * DAY;
    });

    if (due.length) {
      // Dedup: skip if we already sent a follow-up within the shortest window.
      const minWindow = Math.min(...fuOrgs.map((o) => o.settings.followUpDays)) * DAY;
      const since = new Date(now - minWindow).toISOString();
      const recent = await db
        .select({ clientId: notifications.clientId, sentAt: notifications.sentAt })
        .from(notifications)
        .where(
          and(
            eq(notifications.type, "followup"),
            inArray(notifications.clientId, due.map((c) => c.id)),
            gte(notifications.sentAt, since),
          ),
        );
      const recentSet = new Set(recent.map((r) => r.clientId));

      for (const c of due) {
        if (recentSet.has(c.id)) continue;
        const org = orgs.get(c.orgId)!;
        const body =
          org.settings.followUpText.trim() ||
          `¡Hace un tiempo que no te vemos por ${org.name}! Te dejamos el link para que reserves tu próximo turno cuando quieras. Te esperamos 💅`;
        const ok = await sendEmail({
          to: c.email!,
          subject: `Te extrañamos en ${org.name} 💕`,
          html: campaignEmailHtml({
            orgName: org.name,
            clientName: c.name,
            body,
            unsubscribeUrl: publicUrl(`/no-recibir/${createUnsubscribeToken(c.id)}`),
            ctaText: "Reservar turno",
            ctaUrl: publicUrl(`/${org.slug}/reservar`),
          }),
        });
        if (ok) {
          await db.insert(notifications).values({
            organizationId: c.orgId,
            clientId: c.id,
            type: "followup",
            channel: "email",
            sentAt: new Date().toISOString(),
          });
          result.followups++;
        }
      }
    }
  }

  // ---- 3) Post-visit review requests --------------------------------------
  const rrOrgIds = [...orgs.values()].filter((o) => o.settings.reviewRequestEnabled).map((o) => o.id);
  if (rrOrgIds.length) {
    const maxAgo = new Date(now - 7 * DAY).toISOString(); // don't chase old visits
    const rows = await db
      .select({
        id: appointments.id,
        endAt: appointments.endAt,
        bookingCode: appointments.bookingCode,
        orgId: appointments.organizationId,
        email: clients.email,
        clientName: clients.name,
      })
      .from(appointments)
      .innerJoin(clients, eq(clients.id, appointments.clientId))
      .leftJoin(
        notifications,
        and(eq(notifications.appointmentId, appointments.id), eq(notifications.type, "review_request")),
      )
      .where(
        and(
          inArray(appointments.organizationId, rrOrgIds),
          eq(appointments.status, "atendido"),
          isNotNull(clients.email),
          gte(appointments.endAt, maxAgo),
          isNull(notifications.id),
        ),
      )
      .limit(300);

    for (const r of rows) {
      const org = orgs.get(r.orgId)!;
      // Wait the configured number of hours after the appointment ended.
      if (new Date(r.endAt).getTime() > now - org.settings.reviewRequestHoursAfter * H) continue;
      const reviewUrl = publicUrl(`/${org.slug}/opiniones?t=${createBookingToken(r.id, r.bookingCode)}`);
      const ok = await sendEmail({
        to: r.email!,
        subject: `¿Cómo estuvo tu visita a ${org.name}?`,
        html: reviewRequestEmailHtml({ orgName: org.name, clientName: r.clientName, reviewUrl }),
      });
      if (ok) {
        await db.insert(notifications).values({
          organizationId: r.orgId,
          appointmentId: r.id,
          type: "review_request",
          channel: "email",
          sentAt: new Date().toISOString(),
        });
        result.reviewRequests++;
      }
    }
  }

  return NextResponse.json(result);
}
