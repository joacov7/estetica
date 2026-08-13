import Link from "next/link";
import { DollarSign, CalendarCheck, Receipt, XCircle, UserX, UserPlus } from "lucide-react";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import { appointments, appointmentServices, clients, professionals } from "@/db/schema";
import { getCurrentOrg } from "@/features/org/current";
import { StatCard } from "@/components/ui/stat-card";
import { buttonVariants } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

type Period = "day" | "week" | "month";
const PERIODS: { key: Period; label: string }[] = [
  { key: "day", label: "Hoy" },
  { key: "week", label: "Últimos 7 días" },
  { key: "month", label: "Este mes" },
];

function rangeStart(period: Period, today: string): string {
  const [y, m, d] = today.split("-").map(Number);
  if (period === "day") return today;
  if (period === "month") return `${today.slice(0, 8)}01`;
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 6);
  return dt.toISOString().slice(0, 10);
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { org } = await getCurrentOrg();
  if (!org) return <p className="text-muted-foreground">Todavía no tenés un negocio.</p>;

  const sp = await searchParams;
  const period: Period = sp.period === "day" || sp.period === "week" ? sp.period : "month";

  const today = formatInTimeZone(new Date(), org.timezone, "yyyy-MM-dd");
  const startIso = fromZonedTime(`${rangeStart(period, today)}T00:00:00`, org.timezone).toISOString();
  const endIso = new Date(fromZonedTime(`${today}T00:00:00`, org.timezone).getTime() + 24 * 60 * 60 * 1000).toISOString();

  const [appts, pros] = await Promise.all([
    db
      .select({ id: appointments.id, professionalId: appointments.professionalId, status: appointments.status })
      .from(appointments)
      .where(and(eq(appointments.organizationId, org.id), gte(appointments.startAt, startIso), lt(appointments.startAt, endIso))),
    db.select({ id: professionals.id, name: professionals.name }).from(professionals).where(eq(professionals.organizationId, org.id)),
  ]);

  const attended = appts.filter((a) => a.status === "atendido");
  const cancelled = appts.filter((a) => a.status === "cancelado").length;
  const noShow = appts.filter((a) => a.status === "no_show").length;

  // Revenue + service ranking + revenue per professional.
  let revenue = 0;
  const serviceCount = new Map<string, number>();
  const revByPro = new Map<string, number>();
  if (attended.length > 0) {
    const proByAppt = new Map(attended.map((a) => [a.id, a.professionalId]));
    const lines = await db
      .select({ appointmentId: appointmentServices.appointmentId, name: appointmentServices.name, priceCents: appointmentServices.priceCents })
      .from(appointmentServices)
      .where(inArray(appointmentServices.appointmentId, attended.map((a) => a.id)));
    for (const l of lines) {
      revenue += l.priceCents;
      serviceCount.set(l.name, (serviceCount.get(l.name) ?? 0) + 1);
      const proId = proByAppt.get(l.appointmentId);
      if (proId) revByPro.set(proId, (revByPro.get(proId) ?? 0) + l.priceCents);
    }
  }

  // New clients in the period.
  const newClients = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.organizationId, org.id), gte(clients.createdAt, startIso), lt(clients.createdAt, endIso)));

  const currency = { currency: org.currency, locale: org.locale };
  const ticket = attended.length > 0 ? Math.round(revenue / attended.length) : 0;

  const topServices = [...serviceCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxService = topServices[0]?.[1] ?? 1;
  const proName = new Map(pros.map((p) => [p.id, p.name]));
  const proRevenue = [...revByPro.entries()].map(([id, cents]) => ({ name: proName.get(id) ?? "—", cents })).sort((a, b) => b.cents - a.cents);
  const maxPro = proRevenue[0]?.cents ?? 1;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Estadísticas</h1>
          <p className="text-muted-foreground">El pulso de tu negocio.</p>
        </div>
        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <Link key={p.key} href={`/dashboard/analytics?period=${p.key}`} className={buttonVariants({ variant: period === p.key ? "secondary" : "outline", size: "sm" })}>
              {p.label}
            </Link>
          ))}
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Facturación" value={formatMoney(revenue, currency)} icon={DollarSign} />
        <StatCard label="Turnos atendidos" value={String(attended.length)} icon={CalendarCheck} />
        <StatCard label="Ticket promedio" value={formatMoney(ticket, currency)} icon={Receipt} />
        <StatCard label="Cancelaciones" value={String(cancelled)} icon={XCircle} />
        <StatCard label="No-shows" value={String(noShow)} icon={UserX} />
        <StatCard label="Clientas nuevas" value={String(newClients.length)} icon={UserPlus} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RankCard title="Servicios más vendidos" empty="Sin datos en este período.">
          {topServices.map(([name, n]) => (
            <Bar key={name} label={name} value={`${n}`} pct={(n / maxService) * 100} />
          ))}
        </RankCard>
        <RankCard title="Facturación por profesional" empty="Sin datos en este período.">
          {proRevenue.map((p) => (
            <Bar key={p.name} label={p.name} value={formatMoney(p.cents, currency)} pct={(p.cents / maxPro) * 100} />
          ))}
        </RankCard>
      </div>
    </div>
  );
}

function RankCard({ title, children, empty }: { title: string; children: React.ReactNode; empty: string }) {
  const arr = Array.isArray(children) ? children : [children];
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-4 font-display text-lg font-semibold">{title}</h2>
      <div className="space-y-3">{arr.length > 0 && arr.some(Boolean) ? children : <p className="text-sm text-muted-foreground">{empty}</p>}</div>
    </div>
  );
}

function Bar({ label, value, pct }: { label: string; value: string; pct: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(pct, 4)}%` }} />
      </div>
    </div>
  );
}
