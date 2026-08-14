import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { giftCards } from "@/db/schema";
import { getCurrentOrg } from "@/features/org/current";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";
import { GiftCardForm } from "@/features/loyalty/gift-card-form";
import { RedeemGiftCard } from "@/features/loyalty/redeem-gift-card";

export const dynamic = "force-dynamic";

export default async function GiftCardsPage() {
  const { org } = await getCurrentOrg();
  if (!org) return <p className="text-muted-foreground">Todavía no tenés un negocio.</p>;

  const list = await db.select().from(giftCards).where(eq(giftCards.organizationId, org.id)).orderBy(desc(giftCards.createdAt));
  const currency = { currency: org.currency, locale: org.locale };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">Gift cards</h1>
        <p className="text-muted-foreground">Tarjetas de regalo con saldo.</p>
      </header>

      <GiftCardForm />

      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {list.map((g) => (
          <div key={g.id} className="flex items-center justify-between gap-4 p-4">
            <div>
              <div className="flex items-center gap-2">
                <code className="rounded-lg bg-muted px-2 py-0.5 text-sm font-medium">{g.code}</code>
                {g.status !== "active" && <Badge variant="muted">Usada</Badge>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Saldo <span className="font-medium text-foreground">{formatMoney(g.balanceCents, currency)}</span>
                {" "}de {formatMoney(g.initialCents, currency)}
                {g.note && ` · ${g.note}`}
              </p>
            </div>
            {g.status === "active" && <RedeemGiftCard giftCardId={g.id} />}
          </div>
        ))}
        {list.length === 0 && <p className="p-6 text-muted-foreground">Todavía no creaste gift cards.</p>}
      </div>
    </div>
  );
}
