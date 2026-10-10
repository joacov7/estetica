"use client";

import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateLoyaltySettings } from "./actions";
import type { OrgSettings } from "@/lib/settings";

export function LoyaltySettingsForm({ initial }: { initial: OrgSettings }) {
  const [enabled, setEnabled] = useState(initial.loyaltyEnabled);
  const [earnPer, setEarnPer] = useState(String(Math.round(initial.loyaltyEarnPerCents / 100)));
  const [pointValue, setPointValue] = useState(String(initial.loyaltyPointValueCents / 100));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = () => setSaved(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await updateLoyaltySettings({
      loyaltyEnabled: enabled,
      loyaltyEarnPer: Number(earnPer || 0),
      loyaltyPointValue: Number(pointValue || 0),
    });
    setSaving(false);
    if (res.ok) setSaved(true);
    else setError(res.error);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div>
        <h2 className="font-display text-lg font-semibold">Puntos de fidelidad</h2>
        <p className="text-sm text-muted-foreground">
          Las clientas suman puntos cuando marcás su turno como atendido, y los canjeás como
          descuento en el salón.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={enabled ? "Desactivar" : "Activar"}
          onClick={() => { setEnabled((v) => !v); dirty(); }}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? "bg-primary" : "bg-muted"}`}
        >
          <span className={`inline-block size-4 transform rounded-full bg-white transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
        </button>
        <span className="text-sm font-medium">Activar programa de puntos</span>
      </div>

      {enabled && (
        <div className="grid max-w-md gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Gana 1 punto cada</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">$</span>
              <Input value={earnPer} onChange={(e) => { setEarnPer(e.target.value); dirty(); }} inputMode="numeric" placeholder="1000" />
            </div>
            <p className="text-xs text-muted-foreground">Sobre el total gastado en el turno.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Cada punto vale</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">$</span>
              <Input value={pointValue} onChange={(e) => { setPointValue(e.target.value); dirty(); }} inputMode="decimal" placeholder="1" />
            </div>
            <p className="text-xs text-muted-foreground">Al canjear, como descuento.</p>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />} Guardar
        </Button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            <Check className="size-4 text-primary" /> Guardado
          </span>
        )}
      </div>
    </form>
  );
}
