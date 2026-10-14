import { and, count, eq, gte, isNotNull, sum } from "drizzle-orm";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { Star, Megaphone, HeartHandshake, Gift, Cake, Tag, Users, Sparkles } from "lucide-react";
import { db } from "@/db";
import { reviews, campaigns, notifications, clients, appointments, loyaltyTransactions } from "@/db/schema";
import { getCurrentOrg } from "@/features/org/current";
import { getOrgSettings } from "@/lib/settings";
import { StatCard } from "@/components/ui/stat-card";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export default async function MarketingPage() {
  const { org } = await getCurrentOrg();
  if (!org) return <p className="text-muted-foreground">Todavía no tenés un negocio.</p>;

  const tz = org.timezone;
  const ym = formatInTimeZone(new Date(), tz, "yyyy-MM");
  const monthStartIso = fromZonedTime(`${ym}-01T00:00:00`, tz).toISOString();
  const currency = { currency: org.currency, locale: org.locale };

  const notifCount = (type: string, sinceIso?: string) =>
    db
      .select({ c: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.organizationId, org.id),
          eq(notifications.type, type),
          sinceIso ? gte(notifications.sentAt, sinceIso) : undefined,
        ),
      );

  const [
    reviewRows,
    sentCampaigns,
    [followTotal],
    [followMonth],
    [bdayTotal],
    [reviewReqTotal],
    [campaignNotifTotal],
    referredRows,
    attendedRows,
    [promoAgg],
    settings,
    [loyaltyOutstanding],
    [loyaltyRedeemed],
  ] = await Promise.all([
    db.select({ rating: reviews.rating, status: reviews.status, createdAt: reviews.createdAt }).from(reviews).where(eq(reviews.organizationId, org.id)),
    db.select({ sentCount: campaigns.sentCount, sentAt: campaigns.sentAt }).from(campaigns).where(and(eq(campaigns.organizationId, org.id), eq(campaigns.status, "sent"))),
    notifCount("followup"),
    notifCount("followup", monthStartIso),
    notifCount("birthday"),
    notifCount("review_request"),
    notifCount("campaign"),
    db.select({ id: clients.id }).from(clients).where(and(eq(clients.organizationId, org.id), isNotNull(clients.referredById))),
    db.selectDistinct({ clientId: appointments.clientId }).from(appointments).where(and(eq(appointments.organizationId, org.id), eq(appointments.status, "atendido"))),
    db.select({ c: count(), total: sum(appointments.discountCents) }).from(appointments).where(and(eq(appointments.organizationId, org.id), gte(appointments.discountCents, 1))),
    getOrgSettings(org.id),
    db.select({ total: sum(loyaltyTransactions.points) }).from(loyaltyTransactions).where(eq(loyaltyTransactions.organizationId, org.id)),
    db.select({ total: sum(loyaltyTransactions.points) }).from(loyaltyTransactions).where(and(eq(loyaltyTransactions.organizationId, org.id), eq(loyaltyTransactions.kind, "redeem"))),
  ]);

  // Reviews
  const published = reviewRows.filter((r) => r.status === "published");
  const pending = reviewRows.filter((r) => r.status === "pending").length;
  const avg = published.length ? published.reduce((s, r) => s + r.rating, 0) / published.length : 0;

  // Reviews per month (last 6 months, published)
  const months: { key: string; label: string; count: number }[] = [];
  // Anchor to the 1st of the current month before subtracting, so day-of-month
  // overflow (e.g. Mar 31 − 1 month) can't skip or duplicate a bucket.
  const anchor = new Date();
  anchor.setUTCDate(1);
  for (let i = 5; i >= 0; i--) {
    const d = new Date(anchor);
    d.setUTCMonth(anchor.getUTCMonth() - i);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    months.push({ key, label: MONTHS[d.getUTCMonth()], count: 0 });
  }
  for (const r of published) {
    const key = formatInTimeZone(r.createdAt, tz, "yyyy-MM");
    const m = months.find((x) => x.key === key);
    if (m) m.count++;
  }
  const maxMonth = Math.max(1, ...months.map((m) => m.count));

  // Campaigns
  const campaignsSent = sentCampaigns.length;
  const emailsSent = sentCampaigns.reduce((s, c) => s + (c.sentCount ?? 0), 0);

  // Referrals
  const attended = new Set(attendedRows.map((r) => r.clientId).filter(Boolean) as string[]);
  const referredTotal = referredRows.length;
  const referredConverted = referredRows.filter((r) => attended.has(r.id)).length;

  // Promos
  const promoCount = promoAgg?.c ?? 0;
  const promoTotal = Number(promoAgg?.total ?? 0);

  // Loyalty
  const pointsOutstanding = Number(loyaltyOutstanding?.total ?? 0);
  const pointsRedeemed = Math.abs(Number(loyaltyRedeemed?.total ?? 0));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">Marketing</h1>
        <p className="text-muted-foreground">Cómo vienen tus acciones de fidelización y crecimiento.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Reseñas publicadas" value={published.length ? `${published.length} · ${avg.toFixed(1)}★` : "0"} icon={Star} />
        <StatCard label="Campañas enviadas" value={String(campaignsSent)} icon={Megaphone} />
        <StatCard label="Reenganches (total)" value={String(followTotal.c)} icon={HeartHandshake} />
        <StatCard label="Referidas convertidas" value={`${referredConverted}/${referredTotal}`} icon={Users} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Reseñas por mes */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="font-display text-lg font-semibold">Reseñas por mes</h2>
          <p className="text-sm text-muted-foreground">Opiniones publicadas · pendientes ahora: {pending}</p>
          <ul className="mt-4 space-y-2">
            {months.map((m) => (
              <li key={m.key} className="flex items-center gap-3">
                <span className="w-8 text-xs text-muted-foreground">{m.label}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(m.count / maxMonth) * 100}%` }} />
                </div>
                <span className="w-6 text-right text-sm font-medium">{m.count}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Automatizaciones */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="font-display text-lg font-semibold">Automatizaciones por email</h2>
          <p className="text-sm text-muted-foreground">Mensajes que se enviaron solos.</p>
          <dl className="mt-4 space-y-3">
            <Metric icon={HeartHandshake} label="Reenganches enviados" value={`${followTotal.c}`} hint={`${followMonth.c} este mes`} />
            <Metric icon={Cake} label="Saludos de cumpleaños" value={`${bdayTotal.c}`} />
            <Metric icon={Star} label="Pedidos de reseña" value={`${reviewReqTotal.c}`} />
            <Metric icon={Megaphone} label="Emails de campañas" value={`${campaignNotifTotal.c}`} />
          </dl>
        </section>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Turnos con promo" value={String(promoCount)} icon={Tag} />
        <StatCard label="Descuento total otorgado" value={formatMoney(promoTotal, currency)} icon={Gift} />
      </div>

      {settings.loyaltyEnabled && (
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard
            label="Puntos activos (sin canjear)"
            value={`${pointsOutstanding} · ${formatMoney(pointsOutstanding * settings.loyaltyPointValueCents, currency)}`}
            icon={Sparkles}
          />
          <StatCard label="Puntos canjeados" value={String(pointsRedeemed)} icon={Gift} />
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        Los envíos automáticos requieren tener Resend configurado. Si recién empezás, estos números se
        van llenando a medida que las clientas reservan, cumplen años y dejan opiniones.
      </p>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4 text-primary" /> {label}
      </dt>
      <dd className="text-right">
        <span className="font-display text-lg font-semibold">{value}</span>
        {hint && <span className="ml-2 text-xs text-muted-foreground">{hint}</span>}
      </dd>
    </div>
  );
}
