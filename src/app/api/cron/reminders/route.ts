import { NextResponse } from "next/server";
import { formatInTimeZone } from "date-fns-tz";
import { and, eq, gt, inArray, isNotNull, isNull, lt } from "drizzle-orm";
import { db } from "@/db";
import { appointments, appointmentServices, clients, organizations, settings, notifications } from "@/db/schema";
import { DEFAULT_SETTINGS, type OrgSettings } from "@/lib/settings";
import { emailConfigured, sendEmail, reminderEmailHtml } from "@/services/notifications/email";
import { createBookingToken } from "@/lib/booking-token";

export const dynamic = "force-dynamic";

const H = 60 * 60 * 1000;

/**
 * GET /api/cron/reminders — sends due email reminders. Idempotent: each
 * appointment gets at most one 'reminder_email' notification. Triggered by
 * Vercel Cron (see vercel.json); protected by CRON_SECRET.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!emailConfigured) {
    return NextResponse.json({ sent: 0, note: "email no configurado (falta RESEND_API_KEY)" });
  }

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const maxIso = new Date(now + 48 * H).toISOString();

  // Active, upcoming appointments with a client email and no email reminder yet.
  const rows = await db
    .select({
      id: appointments.id,
      startAt: appointments.startAt,
      bookingCode: appointments.bookingCode,
      orgId: organizations.id,
      orgName: organizations.name,
      tz: organizations.timezone,
      email: clients.email,
      clientName: clients.name,
      data: settings.data,
    })
    .from(appointments)
    .innerJoin(clients, eq(clients.id, appointments.clientId))
    .innerJoin(organizations, eq(organizations.id, appointments.organizationId))
    .leftJoin(settings, eq(settings.organizationId, appointments.organizationId))
    .leftJoin(
      notifications,
      and(eq(notifications.appointmentId, appointments.id), eq(notifications.type, "reminder_email")),
    )
    .where(
      and(
        inArray(appointments.status, ["reservado", "confirmado"]),
        gt(appointments.startAt, nowIso),
        lt(appointments.startAt, maxIso),
        isNotNull(clients.email),
        isNull(notifications.id),
      ),
    )
    .limit(300);

  // Keep only those within each org's configured reminder window (admin-set).
  const due = rows.filter((r) => {
    const s: OrgSettings = { ...DEFAULT_SETTINGS, ...((r.data as Partial<OrgSettings>) ?? {}) };
    if (!s.emailReminderEnabled) return false;
    return new Date(r.startAt).getTime() <= now + s.reminderHoursAhead * H;
  });

  if (due.length === 0) return NextResponse.json({ sent: 0, considered: 0 });

  const svcRows = await db
    .select({ appointmentId: appointmentServices.appointmentId, name: appointmentServices.name })
    .from(appointmentServices)
    .where(inArray(appointmentServices.appointmentId, due.map((d) => d.id)));
  const svcByAppt = new Map<string, string[]>();
  for (const s of svcRows) {
    const l = svcByAppt.get(s.appointmentId) ?? [];
    l.push(s.name);
    svcByAppt.set(s.appointmentId, l);
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL || "";
  let sent = 0;
  for (const r of due) {
    const services = (svcByAppt.get(r.id) ?? []).join(", ") || "tu turno";
    const whenText = formatInTimeZone(r.startAt, r.tz, "EEEE dd/MM 'a las' HH:mm");
    const manageUrl = site ? `${site}/gestionar/${createBookingToken(r.id, r.bookingCode)}` : undefined;
    const ok = await sendEmail({
      to: r.email!,
      subject: `Recordatorio de tu turno en ${r.orgName}`,
      html: reminderEmailHtml({ orgName: r.orgName, clientName: r.clientName, services, whenText, manageUrl }),
    });
    if (ok) {
      await db.insert(notifications).values({
        organizationId: r.orgId,
        appointmentId: r.id,
        type: "reminder_email",
        channel: "email",
        sentAt: new Date().toISOString(),
      });
      sent++;
    }
  }

  return NextResponse.json({ sent, considered: due.length });
}
