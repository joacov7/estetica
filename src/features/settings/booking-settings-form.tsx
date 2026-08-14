"use client";

import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateBookingSettings } from "./actions";

type Settings = { advanceDays: number; leadTimeMinutes: number; cancellationWindowHours: number };

export function BookingSettingsForm({ initial }: { initial: Settings }) {
  const [f, setF] = useState({
    advanceDays: String(initial.advanceDays),
    leadTimeMinutes: String(initial.leadTimeMinutes),
    cancellationWindowHours: String(initial.cancellationWindowHours),
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setF((p) => ({ ...p, [k]: e.target.value }));
    setSaved(false);
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await updateBookingSettings({
      advanceDays: Number(f.advanceDays),
      leadTimeMinutes: Number(f.leadTimeMinutes),
      cancellationWindowHours: Number(f.cancellationWindowHours),
    });
    setSaving(false);
    if (res.ok) setSaved(true);
    else setError(res.error);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div>
        <h2 className="font-display text-lg font-semibold">Reservas</h2>
        <p className="text-sm text-muted-foreground">Reglas para los turnos online.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Se puede reservar hasta (días)</Label>
          <Input value={f.advanceDays} onChange={set("advanceDays")} inputMode="numeric" />
          <p className="text-xs text-muted-foreground">Cuántos días para adelante.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Antelación mínima (min)</Label>
          <Input value={f.leadTimeMinutes} onChange={set("leadTimeMinutes")} inputMode="numeric" />
          <p className="text-xs text-muted-foreground">No se reserva con menos de esto.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Cancelación libre hasta (horas)</Label>
          <Input value={f.cancellationWindowHours} onChange={set("cancellationWindowHours")} inputMode="numeric" />
          <p className="text-xs text-muted-foreground">Antes del turno.</p>
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
