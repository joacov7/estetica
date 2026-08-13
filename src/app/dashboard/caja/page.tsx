import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { getCurrentOrg } from "@/features/org/current";
import { buttonVariants } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { PaymentDialog } from "@/features/caja/payment-dialog";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const KIND_LABEL: Record<string, string> = { payment: "Cobro", deposit: "Seña", tip: "Propina", refund: "Reembolso" };
const METHOD_LABEL: Record<string, string> = { cash: "Efectivo", transfer: "Transferencia", mercadopago: "Mercado Pago", card: "Tarjeta" };

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

export default async function CajaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { org } = await getCurrentOrg();
  if (!org) return <p className="text-muted-foreground">Todavía no tenés un negocio.</p>;

  const sp = await searchParams;
  const today = formatInTimeZone(new Date(), org.timezone, "yyyy-MM-dd");
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : today;

  const dayRef = fromZonedTime(`${date}T00:00:00`, org.timezone);
  const dayStart = dayRef.toISOString();
  const dayEnd = new Date(dayRef.getTime() + DAY_MS).toISOString();

  const rows = await db
    .select({
      id: payments.id,
      kind: payments.kind,
      method: payments.method,
      amountCents: payments.amountCents,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .where(and(eq(payments.organizationId, org.id), gte(payments.createdAt, dayStart), lte(payments.createdAt, dayEnd)))
    .orderBy(desc(payments.createdAt));

  const currency = { currency: org.currency, locale: org.locale };
  const sign = (kind: string) => (kind === "refund" ? -1 : 1);
  const net = rows.reduce((s, r) => s + sign(r.kind) * r.amountCents, 0);

  const byMethod = new Map<string, number>();
  for (const r of rows) byMethod.set(r.method ?? "—", (byMethod.get(r.method ?? "—") ?? 0) + sign(r.kind) * r.amountCents);

  const prettyDate = formatInTimeZone(dayRef, org.timezone, "EEE dd/MM");

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Caja</h1>
          <p className="text-muted-foreground">Cobros, señas y propinas del día.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/dashboard/caja?date=${addDays(date, -1)}`} className={buttonVariants({ variant: "outline", size: "icon" })}>
            <ChevronLeft className="size-4" />
          </Link>
          <Link href="/dashboard/caja" className={buttonVariants({ variant: "secondary", size: "sm" })}>Hoy</Link>
          <span className="min-w-24 text-center text-sm font-medium capitalize">{prettyDate}</span>
          <Link href={`/dashboard/caja?date=${addDays(date, 1)}`} className={buttonVariants({ variant: "outline", size: "icon" })}>
            <ChevronRight className="size-4" />
          </Link>
          <PaymentDialog />
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <span className="text-sm text-muted-foreground">Total del día</span>
          <p className="mt-2 font-display text-2xl font-semibold text-primary">{formatMoney(net, currency)}</p>
        </div>
        {["cash", "transfer", "mercadopago", "card"].map((m) => (
          <div key={m} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <span className="text-sm text-muted-foreground">{METHOD_LABEL[m]}</span>
            <p className="mt-2 font-display text-2xl font-semibold">{formatMoney(byMethod.get(m) ?? 0, currency)}</p>
          </div>
        ))}
      </div>

      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between p-4">
            <div>
              <span className="font-medium">{KIND_LABEL[r.kind] ?? r.kind}</span>
              <span className="ml-2 text-sm text-muted-foreground">{r.method ? METHOD_LABEL[r.method] : ""}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground">{formatInTimeZone(r.createdAt, org.timezone, "HH:mm")}</span>
              <span className={`font-medium ${r.kind === "refund" ? "text-destructive" : ""}`}>
                {r.kind === "refund" ? "-" : ""}{formatMoney(r.amountCents, currency)}
              </span>
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="p-6 text-muted-foreground">Sin movimientos este día.</p>}
      </div>
    </div>
  );
}
