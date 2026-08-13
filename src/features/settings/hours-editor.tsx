"use client";

import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateBusinessHours } from "./actions";

export type HourRow = { weekday: number; enabled: boolean; startTime: string; endTime: string };

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Lun..Dom

export function HoursEditor({ initial }: { initial: HourRow[] }) {
  const [rows, setRows] = useState<HourRow[]>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(weekday: number, patch: Partial<HourRow>) {
    setRows((prev) => prev.map((r) => (r.weekday === weekday ? { ...r, ...patch } : r)));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    const res = await updateBusinessHours({ hours: rows });
    setSaving(false);
    if (res.ok) setSaved(true);
    else setError(res.error);
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="font-display text-lg font-semibold">Horarios de atención</h2>
      <div className="space-y-2">
        {DISPLAY_ORDER.map((wd) => {
          const row = rows.find((r) => r.weekday === wd)!;
          return (
            <div key={wd} className="flex items-center gap-3">
              <button
                type="button"
                aria-label={row.enabled ? "Cerrar" : "Abrir"}
                onClick={() => update(wd, { enabled: !row.enabled })}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                  row.enabled ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`inline-block size-4 transform rounded-full bg-white transition-transform ${
                    row.enabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
              <span className="w-24 text-sm font-medium">{DAY_NAMES[wd]}</span>
              {row.enabled ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={row.startTime}
                    onChange={(e) => update(wd, { startTime: e.target.value })}
                    className="h-9 w-28"
                  />
                  <span className="text-muted-foreground">a</span>
                  <Input
                    type="time"
                    value={row.endTime}
                    onChange={(e) => update(wd, { endTime: e.target.value })}
                    className="h-9 w-28"
                  />
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Cerrado</span>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />} Guardar horarios
        </Button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            <Check className="size-4 text-primary" /> Guardado
          </span>
        )}
      </div>
    </div>
  );
}
