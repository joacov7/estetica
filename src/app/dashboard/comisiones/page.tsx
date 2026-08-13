import Link from "next/link";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import { professionals, professionalPay, appointments, appointmentServices } from "@/db/schema";
import { getCurrentOrg } from "@/features/org/current";
import { buttonVariants } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

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
  dt.setUTCDate(dt.getUTCDate() - 6); // last 7 days
  return dt.toISOString().slice(0, 10);
}

export default async function ComisionesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { org } = await getCurrentOrg();
  if (!org) return <p className="text-muted-foreground">Todavía no tenés un negocio.</p>;

  const sp = await searchParams;
  const period: Period = sp.period === "day" || sp.period === "week" ? sp.period : "month";

  const today = formatInTimeZone(new Date(), org.timezone, "yyyy-MM-dd");
  const startDate = rangeStart(period, today);
  const startIso = fromZonedTime(`${startDate}T00:00:00`, org.timezone).toISOString();
  const endIso = new Date(fromZonedTime(`${today}T00:00:00`, org.timezone).getTime() + 24 * 60 * 60 * 1000).toISOString();

  const [pros, pay, attended] = await Promise.all([
    db.select({ id: professionals.id, name: professionals.name }).from(professionals).where(eq(professionals.organizationId, org.id)),
    db.select().from(professionalPay).where(eq(professionalPay.organizationId, org.id)),
    db
      .select({ id: appointments.id, professionalId: appointments.professionalId })
      .from(appointments)
      .where(
        and(
          eq(appointments.organizationId, org.id),
          eq(appointments.status, "atendido"),
          gte(appointments.startAt, startIso),
          lt(appointments.startAt, endIso),
        ),
      ),
  ]);

  // Revenue per appointment.
  const revByAppt = new Map<string, number>();
  if (attended.length > 0) {
    const lines = await db
      .select({ appointmentId: appointmentServices.appointmentId, priceCents: appointmentServices.priceCents })
      .from(appointmentServices)
      .where(inArray(appointmentServices.appointmentId, attended.map((a) => a.id)));
    for (const l of lines) revByAppt.set(l.appointmentId, (revByAppt.get(l.appointmentId) ?? 0) + l.priceCents);
  }

  const payByPro = new Map(pay.map((p) => [p.professionalId, p]));

  const rows = pros
    .map((pro) => {
      const appts = attended.filter((a) => a.professionalId === pro.id);
      const revenue = appts.reduce((s, a) => s + (revByAppt.get(a.id) ?? 0), 0);
      const cfg = payByPro.get(pro.id);
      let commission = 0;
      if (cfg) {
        commission =
          cfg.commissionType === "percentage"
            ? Math.round((revenue * cfg.commissionValue) / 100)
            : Math.round(cfg.commissionValue) * appts.length; // fixed per turno (cents)
      }
      return {
        id: pro.id,
        name: pro.name,
        count: appts.length,
        revenue,
        commission,
        net: revenue - commission,
        cfgLabel: cfg
          ? cfg.commissionType === "percentage"
            ? `${cfg.commissionValue}%`
            : formatMoney(Math.round(cfg.commissionValue), { currency: org.currency, locale: org.locale })
          : "—",
      };
    })
    .filter((r) => r.count > 0);

  const currency = { currency: org.currency, locale: org.locale };
  const totals = rows.reduce(
    (acc, r) => ({ revenue: acc.revenue + r.revenue, commission: acc.commission + r.commission, net: acc.net + r.net }),
    { revenue: 0, commission: 0, net: 0 },
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Comisiones</h1>
          <p className="text-muted-foreground">Calculadas sobre turnos atendidos.</p>
        </div>
        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <Link
              key={p.key}
              href={`/dashboard/comisiones?period=${p.key}`}
              className={buttonVariants({ variant: period === p.key ? "secondary" : "outline", size: "sm" })}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Facturado" value={formatMoney(totals.revenue, currency)} />
        <Stat label="Comisiones" value={formatMoney(totals.commission, currency)} />
        <Stat label="Ganancia del negocio" value={formatMoney(totals.net, currency)} highlight />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="p-4 font-medium">Profesional</th>
              <th className="p-4 font-medium">Turnos</th>
              <th className="p-4 font-medium">Facturado</th>
              <th className="p-4 font-medium">Comisión</th>
              <th className="p-4 font-medium">Se lleva</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="p-4 font-medium">{r.name}</td>
                <td className="p-4">{r.count}</td>
                <td className="p-4">{formatMoney(r.revenue, currency)}</td>
                <td className="p-4 text-muted-foreground">{r.cfgLabel}</td>
                <td className="p-4 font-medium text-primary">{formatMoney(r.commission, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-6 text-muted-foreground">No hay turnos atendidos en este período.</p>}
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <span className="text-sm text-muted-foreground">{label}</span>
      <p className={cn("mt-2 font-display text-2xl font-semibold", highlight && "text-primary")}>{value}</p>
    </div>
  );
}
