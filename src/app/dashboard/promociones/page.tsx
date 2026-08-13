import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { promotions } from "@/db/schema";
import { getCurrentOrg } from "@/features/org/current";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";
import { PromotionForm } from "@/features/promotions/promotion-form";
import { PromotionToggle } from "@/features/promotions/promotion-toggle";

export const dynamic = "force-dynamic";

export default async function PromocionesPage() {
  const { org } = await getCurrentOrg();
  if (!org) return <p className="text-muted-foreground">Todavía no tenés un negocio.</p>;

  const list = await db
    .select()
    .from(promotions)
    .where(eq(promotions.organizationId, org.id))
    .orderBy(desc(promotions.createdAt));

  const currency = { currency: org.currency, locale: org.locale };
  const discountText = (p: (typeof list)[number]) =>
    p.discountType === "percentage"
      ? `${p.discountValue}% off`
      : `${formatMoney(Math.round(p.discountValue), currency)} off`;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">Promociones</h1>
        <p className="text-muted-foreground">Descuentos y códigos para tus clientas.</p>
      </header>

      <PromotionForm />

      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {list.map((p) => (
          <div key={p.id} className="flex items-center justify-between p-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{p.name}</span>
                {p.code && <Badge variant="gold">{p.code}</Badge>}
                {!p.isActive && <Badge variant="muted">Inactiva</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">{discountText(p)}</p>
            </div>
            <PromotionToggle id={p.id} isActive={p.isActive} />
          </div>
        ))}
        {list.length === 0 && <p className="p-6 text-muted-foreground">Todavía no cargaste promociones.</p>}
      </div>
    </div>
  );
}
