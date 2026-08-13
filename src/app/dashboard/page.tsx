import Link from "next/link";
import { DollarSign, CalendarCheck, Users, Scissors } from "lucide-react";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { and, count, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { services, professionals, clients, appointments, appointmentServices } from "@/db/schema";
import { getCurrentOrg } from "@/features/org/current";
import { StatCard } from "@/components/ui/stat-card";
import { buttonVariants } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

const ACTIVE = ["reservado", "confirmado", "atendido"] as const;

export default async function DashboardHome() {
  const { org } = await getCurrentOrg();
  if (!org) return <NoOrg />;

  const todayStr = formatInTimeZone(new Date(), org.timezone, "yyyy-MM-dd");
  const dayStart = fromZonedTime(`${todayStr}T00:00:00`, org.timezone).toISOString();
  const dayEnd = fromZonedTime(`${todayStr}T23:59:59`, org.timezone).toISOString();

  const [[svcCount], [proCount], [cliCount], todays] = await Promise.all([
    db.select({ c: count() }).from(services).where(and(eq(services.organizationId, org.id), eq(services.isActive, true))),
    db.select({ c: count() }).from(professionals).where(and(eq(professionals.organizationId, org.id), eq(professionals.isActive, true))),
    db.select({ c: count() }).from(clients).where(eq(clients.organizationId, org.id)),
    db
      .select({ id: appointments.id })
      .from(appointments)
      .where(
        and(
          eq(appointments.organizationId, org.id),
          gte(appointments.startAt, dayStart),
          lte(appointments.startAt, dayEnd),
          inArray(appointments.status, [...ACTIVE]),
        ),
      ),
  ]);

  let revenue = 0;
  if (todays.length > 0) {
    const lines = await db
      .select({ priceCents: appointmentServices.priceCents })
      .from(appointmentServices)
      .where(inArray(appointmentServices.appointmentId, todays.map((a) => a.id)));
    revenue = lines.reduce((s, x) => s + x.priceCents, 0);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">{org.name}</h1>
        <p className="text-muted-foreground">Resumen de hoy</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Facturación de hoy" value={formatMoney(revenue, { currency: org.currency, locale: org.locale })} icon={DollarSign} />
        <StatCard label="Turnos de hoy" value={String(todays.length)} icon={CalendarCheck} />
        <StatCard label="Servicios activos" value={String(svcCount.c)} icon={Scissors} />
        <StatCard label="Clientes" value={String(cliCount.c)} icon={Users} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="font-display text-lg font-semibold">Profesionales activos</h2>
        <p className="mt-1 text-3xl font-semibold">{proCount.c}</p>
        <p className="text-sm text-muted-foreground">
          La agenda por profesional y el detalle de turnos se construyen a continuación.
        </p>
      </div>
    </div>
  );
}

function NoOrg() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <h1 className="font-display text-2xl font-semibold">Todavía no tenés un negocio</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">
        Creá tu negocio para empezar a cargar servicios, profesionales y recibir turnos.
      </p>
      <Link href="/signup" className={buttonVariants({ className: "mt-6" })}>
        Crear mi negocio
      </Link>
    </div>
  );
}
