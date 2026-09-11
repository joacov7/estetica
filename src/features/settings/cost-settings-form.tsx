"use client";

import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateCostSettings } from "./actions";

type Settings = { insumosPct: number; monthlyFixedCents: number };

export function CostSettingsForm({ initial }: { initial: Settings }) {
  const [insumos, setInsumos] = useState(String(initial.insumosPct));
  const [fixed, setFixed] = useState(String(Math.round(initial.monthlyFixedCents / 100)));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await updateCostSettings({ insumosPct: Number(insumos), monthlyFixed: Number(fixed) });
    setSaving(false);
    if (res.ok) setSaved(true);
    else setError(res.error);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div>
        <h2 className="font-display text-lg font-semibold">Costos del negocio</h2>
        <p className="text-sm text-muted-foreground">
          Se usan para el estado de resultados en Estadísticas.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Insumos (% de la facturación)</Label>
          <Input value={insumos} onChange={(e) => { setInsumos(e.target.value); setSaved(false); }} inputMode="numeric" />
          <p className="text-xs text-muted-foreground">Esmaltes, descartables, etc.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Costos fijos mensuales ($)</Label>
          <Input value={fixed} onChange={(e) => { setFixed(e.target.value); setSaved(false); }} inputMode="numeric" placeholder="250000" />
          <p className="text-xs text-muted-foreground">Alquiler, monotributo, servicios.</p>
        </div>
      </div>
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
