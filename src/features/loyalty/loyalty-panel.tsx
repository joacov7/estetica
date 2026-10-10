"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { Loader2, Sparkles, Gift } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { redeemPoints, adjustPoints } from "./points-actions";

export interface LoyaltyTx {
  points: number;
  kind: string;
  reason: string | null;
  createdAt: string;
}

const KIND_LABEL: Record<string, string> = { earn: "Ganados", redeem: "Canje", adjust: "Ajuste" };

export function LoyaltyPanel({
  clientId,
  balance,
  pointValueCents,
  currency,
  transactions,
  timezone,
}: {
  clientId: string;
  balance: number;
  pointValueCents: number;
  currency: { currency: string; locale: string };
  transactions: LoyaltyTx[];
  timezone: string;
}) {
  const router = useRouter();
  const [redeem, setRedeem] = useState("");
  const [adjust, setAdjust] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [showAdjust, setShowAdjust] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const worth = (pts: number) => formatMoney(pts * pointValueCents, currency);

  async function doRedeem() {
    const n = Number(redeem);
    if (!n || n <= 0) return setError("Ingresá cuántos puntos canjear.");
    setBusy(true);
    setError(null);
    const res = await redeemPoints(clientId, n, `Canje de ${n} puntos`);
    setBusy(false);
    if (res.ok) { setRedeem(""); router.refresh(); }
    else setError(res.error);
  }

  async function doAdjust() {
    const n = Number(adjust);
    if (!n) return setError("Ingresá un número (+ o −).");
    setBusy(true);
    setError(null);
    const res = await adjustPoints(clientId, n, adjustReason || undefined);
    setBusy(false);
    if (res.ok) { setAdjust(""); setAdjustReason(""); setShowAdjust(false); router.refresh(); }
    else setError(res.error);
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="flex items-center gap-1.5 font-display text-2xl font-semibold text-primary">
            <Sparkles className="size-5" /> {balance}
          </p>
          <p className="text-xs text-muted-foreground">
            puntos {balance > 0 && `· equivalen a ${worth(balance)}`}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <input
          value={redeem}
          onChange={(e) => { setRedeem(e.target.value.replace(/[^0-9]/g, "")); setError(null); }}
          inputMode="numeric"
          placeholder="Puntos a canjear"
          className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
        />
        <button
          onClick={doRedeem}
          disabled={busy || !redeem}
          className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Gift className="size-4" />} Canjear
        </button>
      </div>
      {redeem && Number(redeem) > 0 && (
        <p className="text-xs text-muted-foreground">Equivale a {worth(Number(redeem))} de descuento.</p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!showAdjust ? (
        <button onClick={() => setShowAdjust(true)} className="text-xs text-muted-foreground hover:text-foreground">
          Ajustar manualmente
        </button>
      ) : (
        <div className="space-y-2 border-t border-border pt-2">
          <div className="flex gap-2">
            <input
              value={adjust}
              onChange={(e) => { setAdjust(e.target.value.replace(/[^0-9-]/g, "")); setError(null); }}
              placeholder="+10 o -5"
              className="w-24 rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
            />
            <input
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder="Motivo (opcional)"
              className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
            />
            <button onClick={doAdjust} disabled={busy || !adjust} className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50">
              Guardar
            </button>
          </div>
        </div>
      )}

      {transactions.length > 0 && (
        <ul className="space-y-1.5 border-t border-border pt-2">
          {transactions.map((t, i) => (
            <li key={i} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {formatInTimeZone(t.createdAt, timezone, "dd/MM/yy")} · {t.reason || KIND_LABEL[t.kind] || t.kind}
              </span>
              <span className={t.points >= 0 ? "font-medium text-primary" : "font-medium text-muted-foreground"}>
                {t.points >= 0 ? "+" : ""}{t.points}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
