"use client";

import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateMarketingSettings } from "./actions";
import type { OrgSettings } from "@/lib/settings";

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        aria-label={on ? "Desactivar" : "Activar"}
        onClick={onClick}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${on ? "bg-primary" : "bg-muted"}`}
      >
        <span className={`inline-block size-4 transform rounded-full bg-white transition-transform ${on ? "translate-x-6" : "translate-x-1"}`} />
      </button>
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

export function MarketingSettingsForm({ initial }: { initial: OrgSettings }) {
  const [reviewsEnabled, setReviewsEnabled] = useState(initial.reviewsEnabled);
  const [reviewRequestEnabled, setReviewRequestEnabled] = useState(initial.reviewRequestEnabled);
  const [reviewRequestHoursAfter, setReviewHours] = useState(String(initial.reviewRequestHoursAfter));
  const [birthdayEnabled, setBirthdayEnabled] = useState(initial.birthdayGreetingEnabled);
  const [birthdayText, setBirthdayText] = useState(initial.birthdayGreetingText);
  const [followUpEnabled, setFollowUpEnabled] = useState(initial.followUpEnabled);
  const [followUpDays, setFollowUpDays] = useState(String(initial.followUpDays));
  const [followUpText, setFollowUpText] = useState(initial.followUpText);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = () => setSaved(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await updateMarketingSettings({
      reviewsEnabled,
      reviewRequestEnabled,
      reviewRequestHoursAfter: Number(reviewRequestHoursAfter),
      birthdayGreetingEnabled: birthdayEnabled,
      birthdayGreetingText: birthdayText,
      followUpEnabled,
      followUpDays: Number(followUpDays),
      followUpText,
    });
    setSaving(false);
    if (res.ok) setSaved(true);
    else setError(res.error);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div>
        <h2 className="font-display text-lg font-semibold">Reseñas y fidelización</h2>
        <p className="text-sm text-muted-foreground">
          Opiniones, saludos de cumpleaños y mensajes para reenganchar clientas. Los envíos por email
          requieren tener Resend configurado.
        </p>
      </div>

      {/* Reviews */}
      <div className="space-y-3 border-t border-border pt-4">
        <Toggle on={reviewsEnabled} onClick={() => { setReviewsEnabled((v) => !v); dirty(); }} label="Aceptar opiniones y mostrarlas en la página" />
        <Toggle on={reviewRequestEnabled} onClick={() => { setReviewRequestEnabled((v) => !v); dirty(); }} label="Pedir opinión por email después del turno" />
        {reviewRequestEnabled && (
          <div className="max-w-xs space-y-1.5">
            <Label>Cuántas horas después del turno</Label>
            <Input value={reviewRequestHoursAfter} onChange={(e) => { setReviewHours(e.target.value); dirty(); }} inputMode="numeric" />
          </div>
        )}
      </div>

      {/* Birthday */}
      <div className="space-y-3 border-t border-border pt-4">
        <Toggle on={birthdayEnabled} onClick={() => { setBirthdayEnabled((v) => !v); dirty(); }} label="Saludar por email en el cumpleaños" />
        {birthdayEnabled && (
          <div className="space-y-1.5">
            <Label>Mensaje de cumpleaños (opcional)</Label>
            <textarea
              value={birthdayText}
              onChange={(e) => { setBirthdayText(e.target.value); dirty(); }}
              rows={3}
              maxLength={1000}
              placeholder="Si lo dejás vacío usamos un saludo cálido por defecto."
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
        )}
      </div>

      {/* Follow-up */}
      <div className="space-y-3 border-t border-border pt-4">
        <Toggle on={followUpEnabled} onClick={() => { setFollowUpEnabled((v) => !v); dirty(); }} label="Reenganchar a clientas que hace tiempo no vienen" />
        {followUpEnabled && (
          <>
            <div className="max-w-xs space-y-1.5">
              <Label>Después de cuántos días sin venir</Label>
              <Input value={followUpDays} onChange={(e) => { setFollowUpDays(e.target.value); dirty(); }} inputMode="numeric" />
            </div>
            <div className="space-y-1.5">
              <Label>Mensaje (opcional)</Label>
              <textarea
                value={followUpText}
                onChange={(e) => { setFollowUpText(e.target.value); dirty(); }}
                rows={3}
                maxLength={1000}
                placeholder="Si lo dejás vacío usamos un mensaje por defecto."
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          </>
        )}
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
