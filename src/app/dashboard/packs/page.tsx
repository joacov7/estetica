import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { servicePacks, services } from "@/db/schema";
import { getCurrentOrg } from "@/features/org/current";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";
import { PackForm } from "@/features/loyalty/pack-form";
import { PackToggle } from "@/features/loyalty/pack-toggle";

export const dynamic = "force-dynamic";

export default async function PacksPage() {
  const { org } = await getCurrentOrg();
  if (!org) return <p className="text-muted-foreground">Todavía no tenés un negocio.</p>;

  const [list, svc] = await Promise.all([
    db.select().from(servicePacks).where(eq(servicePacks.organizationId, org.id)).orderBy(desc(servicePacks.createdAt)),
    db.select({ id: services.id, name: services.name }).from(services).where(and(eq(services.organizationId, org.id), eq(services.isActive, true))).orderBy(asc(services.sortOrder)),
  ]);
  const currency = { currency: org.currency, locale: org.locale };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">Packs</h1>
        <p className="text-muted-foreground">Bonos prepagos. Se venden desde la ficha de la clienta.</p>
      </header>

      <PackForm services={svc} />

      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {list.map((p) => (
          <div key={p.id} className="flex items-center justify-between p-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{p.name}</span>
                {!p.isActive && <Badge variant="muted">Inactivo</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">{p.quantity} usos</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-display font-semibold text-primary">{formatMoney(p.priceCents, currency)}</span>
              <PackToggle id={p.id} isActive={p.isActive} />
            </div>
          </div>
        ))}
        {list.length === 0 && <p className="p-6 text-muted-foreground">Todavía no creaste packs.</p>}
      </div>
    </div>
  );
}
