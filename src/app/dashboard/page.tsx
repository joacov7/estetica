import { DollarSign, CalendarCheck, Users, Scissors, AlertCircle } from "lucide-react";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { getCurrentOrg } from "@/features/org/current";
import { createAdminClient } from "@/lib/supabase/admin";
import { StatCard } from "@/components/ui/stat-card";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  const { org, isDevFallback } = await getCurrentOrg();
  if (!org) {
    return <EmptyOrg />;
  }

  const db = createAdminClient();
  const todayStr = formatInTimeZone(new Date(), org.timezone, "yyyy-MM-dd");
  const dayStart = fromZonedTime(`${todayStr}T00:00:00`, org.timezone).toISOString();
  const dayEnd = fromZonedTime(`${todayStr}T23:59:59`, org.timezone).toISOString();

  const [servicesCount, prosCount, clientsCount, todaysAppts] = await Promise.all([
    db.from("services").select("id", { count: "exact", head: true }).eq("organization_id", org.id).eq("is_active", true),
    db.from("professionals").select("id", { count: "exact", head: true }).eq("organization_id", org.id).eq("is_active", true),
    db.from("clients").select("id", { count: "exact", head: true }).eq("organization_id", org.id),
    db
      .from("appointments")
      .select("id")
      .eq("organization_id", org.id)
      .gte("start_at", dayStart)
      .lte("start_at", dayEnd)
      .in("status", ["reservado", "confirmado", "atendido"]),
  ]);

  const appts = todaysAppts.data ?? [];

  // Sum today's revenue from the snapshotted appointment_services.
  let revenue = 0;
  if (appts.length > 0) {
    const { data: lines } = await db
      .from("appointment_services")
      .select("price_cents")
      .in(
        "appointment_id",
        appts.map((a) => a.id),
      );
    revenue = (lines ?? []).reduce((s, x) => s + x.price_cents, 0);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">{org.name}</h1>
        <p className="text-muted-foreground">Resumen de hoy</p>
      </header>

      {isDevFallback && (
        <div className="flex items-start gap-2 rounded-xl border border-gold/40 bg-gold/10 p-3 text-sm text-gold-foreground">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>
            Modo desarrollo: no hay sesión iniciada, mostrando la primera organización.
            La autenticación es el próximo paso — este panel quedará detrás de login.
          </span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Facturación de hoy"
          value={formatMoney(revenue, { currency: org.currency, locale: org.locale })}
          icon={DollarSign}
        />
        <StatCard label="Turnos de hoy" value={String(appts.length)} icon={CalendarCheck} />
        <StatCard label="Servicios activos" value={String(servicesCount.count ?? 0)} icon={Scissors} />
        <StatCard label="Clientes" value={String(clientsCount.count ?? 0)} icon={Users} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="font-display text-lg font-semibold">Profesionales activos</h2>
        <p className="mt-1 text-3xl font-semibold">{prosCount.count ?? 0}</p>
        <p className="text-sm text-muted-foreground">
          La agenda por profesional y el detalle de turnos se construyen a continuación.
        </p>
      </div>
    </div>
  );
}

function EmptyOrg() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <h1 className="font-display text-2xl font-semibold">No hay ninguna organización</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">
        Corré las migraciones y el seed de Supabase para crear la organización de ejemplo
        &ldquo;Buenas Uñas&rdquo;.
      </p>
    </div>
  );
}
