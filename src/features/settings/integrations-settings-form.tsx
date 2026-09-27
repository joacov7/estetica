"use client";

import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateIntegrationsSettings } from "./actions";
import type { OrgSettings } from "@/lib/settings";

export function IntegrationsSettingsForm({ initial }: { initial: OrgSettings }) {
  const [cc, setCc] = useState(initial.whatsappCountryCode);
  const [reviewUrl, setReviewUrl] = useState(initial.googleReviewUrl);
  const [placeUrl, setPlaceUrl] = useState(initial.googlePlaceUrl);
  const [rating, setRating] = useState(String(initial.googleRating || ""));
  const [reviewCount, setReviewCount] = useState(String(initial.googleReviewCount || ""));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = () => setSaved(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await updateIntegrationsSettings({
      whatsappCountryCode: cc,
      googleReviewUrl: reviewUrl,
      googlePlaceUrl: placeUrl,
      googleRating: Number(rating || 0),
      googleReviewCount: Number(reviewCount || 0),
    });
    setSaving(false);
    if (res.ok) setSaved(true);
    else setError(res.error);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div>
        <h2 className="font-display text-lg font-semibold">WhatsApp y Google</h2>
        <p className="text-sm text-muted-foreground">
          Cómo se arman los links de WhatsApp y tu reputación de Google en la página.
        </p>
      </div>

      <div className="max-w-xs space-y-1.5 border-t border-border pt-4">
        <Label>Código de país para WhatsApp</Label>
        <Input value={cc} onChange={(e) => { setCc(e.target.value); dirty(); }} inputMode="numeric" placeholder="549" />
        <p className="text-xs text-muted-foreground">
          Se antepone al teléfono de cada clienta. En Argentina, celulares: <strong>549</strong>.
        </p>
      </div>

      <div className="space-y-4 border-t border-border pt-4">
        <p className="text-sm font-medium">Reseñas de Google</p>
        <div className="space-y-1.5">
          <Label>Link para dejar reseña</Label>
          <Input
            value={reviewUrl}
            onChange={(e) => { setReviewUrl(e.target.value); dirty(); }}
            placeholder="https://g.page/r/..."
          />
          <p className="text-xs text-muted-foreground">
            Se ofrece a quienes puntúan 4 o 5 estrellas, para sumar reseñas en Google.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>Link a tu perfil de Google</Label>
          <Input
            value={placeUrl}
            onChange={(e) => { setPlaceUrl(e.target.value); dirty(); }}
            placeholder="https://maps.app.goo.gl/..."
          />
        </div>
        <div className="grid max-w-sm grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Puntaje (0 a 5)</Label>
            <Input value={rating} onChange={(e) => { setRating(e.target.value); dirty(); }} inputMode="decimal" placeholder="4.9" />
          </div>
          <div className="space-y-1.5">
            <Label>Cantidad de reseñas</Label>
            <Input value={reviewCount} onChange={(e) => { setReviewCount(e.target.value); dirty(); }} inputMode="numeric" placeholder="120" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Puntaje y cantidad se muestran como tarjeta en tu página. Dejá el puntaje en 0 para ocultarla.
        </p>
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
