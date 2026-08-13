import { getCurrentOrg } from "@/features/org/current";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { ServiceForm } from "@/features/services/service-form";
import { ServiceToggle } from "@/features/services/service-toggle";

export const dynamic = "force-dynamic";

export default async function ServiciosPage() {
  const { org } = await getCurrentOrg();
  if (!org) return <p className="text-muted-foreground">No hay organización.</p>;

  const db = createAdminClient();
  const { data: services } = await db
    .from("services")
    .select("*")
    .eq("organization_id", org.id)
    .order("sort_order");

  const currency = { currency: org.currency, locale: org.locale };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Servicios</h1>
          <p className="text-muted-foreground">Precios, duración y seña de cada servicio.</p>
        </div>
      </header>

      <ServiceForm />

      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {(services ?? []).map((s) => (
          <div key={s.id} className="flex items-center justify-between p-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{s.name}</span>
                {!s.is_active && <Badge variant="muted">Inactivo</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">
                {s.duration_min} min
                {s.buffer_min > 0 && ` · +${s.buffer_min} min limpieza`}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-display font-semibold text-primary">
                {formatMoney(s.price_cents, currency)}
              </span>
              <ServiceToggle id={s.id} isActive={s.is_active} />
            </div>
          </div>
        ))}
        {(services ?? []).length === 0 && (
          <p className="p-6 text-muted-foreground">Todavía no cargaste servicios.</p>
        )}
      </div>
    </div>
  );
}
