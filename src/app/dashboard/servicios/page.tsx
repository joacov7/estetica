import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { services } from "@/db/schema";
import { getCurrentOrg } from "@/features/org/current";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { ServiceForm } from "@/features/services/service-form";
import { ServiceToggle } from "@/features/services/service-toggle";

export const dynamic = "force-dynamic";

export default async function ServiciosPage() {
  const { org } = await getCurrentOrg();
  if (!org) return <p className="text-muted-foreground">Todavía no tenés un negocio.</p>;

  const list = await db
    .select()
    .from(services)
    .where(eq(services.organizationId, org.id))
    .orderBy(asc(services.sortOrder));

  const currency = { currency: org.currency, locale: org.locale };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">Servicios</h1>
        <p className="text-muted-foreground">Precios, duración y seña de cada servicio.</p>
      </header>

      <ServiceForm />

      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {list.map((s) => (
          <div key={s.id} className="flex items-center justify-between p-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{s.name}</span>
                {!s.isActive && <Badge variant="muted">Inactivo</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">
                {s.durationMin} min{s.bufferMin > 0 && ` · +${s.bufferMin} min limpieza`}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-display font-semibold text-primary">
                {formatMoney(s.priceCents, currency)}
              </span>
              <ServiceToggle id={s.id} isActive={s.isActive} />
            </div>
          </div>
        ))}
        {list.length === 0 && <p className="p-6 text-muted-foreground">Todavía no cargaste servicios.</p>}
      </div>
    </div>
  );
}
