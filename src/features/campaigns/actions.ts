"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations, campaigns, notifications } from "@/db/schema";
import { getCurrentOrg } from "@/features/org/current";
import { emailConfigured, sendEmail, campaignEmailHtml } from "@/services/notifications/email";
import { publicUrl } from "@/lib/site-url";
import { createUnsubscribeToken } from "@/lib/marketing-token";
import { resolveRecipients, type Segment } from "./recipients";

const WRITE_ROLES = ["owner", "admin"];
const MAX_RECIPIENTS = 800;

export type CampaignResult =
  | { ok: true; sent: number; total: number }
  | { ok: false; error: string };

export async function sendCampaign(input: {
  name: string;
  subject: string;
  body: string;
  segment: Segment;
}): Promise<CampaignResult> {
  const { org, role } = await getCurrentOrg();
  if (!org || !role || !WRITE_ROLES.includes(role)) return { ok: false, error: "No autorizado" };

  const name = input.name.trim().slice(0, 120) || "Campaña";
  const subject = input.subject.trim().slice(0, 160);
  const body = input.body.trim().slice(0, 5000);
  const segment = (["all", "inactive", "birthday_month"] as const).includes(input.segment)
    ? input.segment
    : "all";
  if (!subject) return { ok: false, error: "Escribí un asunto." };
  if (!body) return { ok: false, error: "Escribí el mensaje." };
  if (!emailConfigured) {
    return { ok: false, error: "El envío de emails no está configurado (falta RESEND_API_KEY)." };
  }

  const recipients = (await resolveRecipients(org.id, segment)).slice(0, MAX_RECIPIENTS);
  if (recipients.length === 0) return { ok: false, error: "Ese segmento no tiene destinatarias con email." };

  const [orgRow] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, org.id)).limit(1);
  const orgName = orgRow?.name ?? "Tu estética";
  const bookingUrl = publicUrl(`/${org.slug}/reservar`);

  const [row] = await db
    .insert(campaigns)
    .values({ organizationId: org.id, name, subject, body, segment, recipientCount: recipients.length })
    .returning({ id: campaigns.id });

  let sent = 0;
  for (const r of recipients) {
    const unsubscribeUrl = publicUrl(`/no-recibir/${createUnsubscribeToken(r.id)}`);
    const ok = await sendEmail({
      to: r.email,
      subject,
      html: campaignEmailHtml({
        orgName,
        clientName: r.name,
        body,
        unsubscribeUrl,
        ctaText: "Reservar turno",
        ctaUrl: bookingUrl,
      }),
    });
    if (ok) {
      sent++;
      await db.insert(notifications).values({
        organizationId: org.id,
        clientId: r.id,
        type: "campaign",
        channel: "email",
        payload: { campaignId: row.id },
        sentAt: new Date().toISOString(),
      });
    }
  }

  await db
    .update(campaigns)
    .set({ status: "sent", sentCount: sent, sentAt: new Date().toISOString() })
    .where(eq(campaigns.id, row.id));

  revalidatePath("/dashboard/campanas");
  return { ok: true, sent, total: recipients.length };
}
