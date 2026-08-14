"use client";

import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateReminderSettings } from "./actions";

type Settings = { emailReminderEnabled: boolean; reminderHoursAhead: number };

export function ReminderSettingsForm({ initial }: { initial: Settings }) {
  const [enabled, setEnabled] = useState(initial.emailReminderEnabled);
  const [hours, setHours] = useState(String(initial.reminderHoursAhead));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await updateReminderSettings({ emailReminderEnabled: enabled, reminderHoursAhead: Number(hours) });
    setSaving(false);
    if (res.ok) setSaved(true);
    else setError(res.error);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div>
        <h2 className="font-display text-lg font-semibold">Recordatorios por email</h2>
        <p className="text-sm text-muted-foreground">
          Se envían automáticamente a las clientas que dejaron su email.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={enabled ? "Desactivar" : "Activar"}
          onClick={() => { setEnabled((v) => !v); setSaved(false); }}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? "bg-primary" : "bg-muted"}`}
        >
          <span className={`inline-block size-4 transform rounded-full bg-white transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
        </button>
        <span className="text-sm font-medium">Enviar recordatorio automático</span>
      </div>

      {enabled && (
        <div className="max-w-xs space-y-1.5">
          <Label>Enviar cuántas horas antes</Label>
          <Input value={hours} onChange={(e) => { setHours(e.target.value); setSaved(false); }} inputMode="numeric" />
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
