"use client";

import { useState } from "react";
import { Star, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { submitReview } from "./actions";
import { Turnstile } from "@/features/booking/turnstile";

export function ReviewForm({
  slug,
  token,
  siteKey,
  verified,
}: {
  slug: string;
  token?: string;
  siteKey?: string;
  verified?: boolean;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | { published: boolean }>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (rating < 1) return setError("Elegí cuántas estrellas.");
    if (siteKey && !captchaToken) return setError("Esperá un segundo a la verificación de seguridad.");
    setBusy(true);
    const res = await submitReview({ slug, rating, comment, name, token, captchaToken });
    setBusy(false);
    if (res.ok) setDone({ published: res.published });
    else setError(res.error);
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <CheckCircle2 className="mx-auto size-10 text-primary" />
        <p className="mt-3 font-display text-xl font-semibold">¡Gracias por tu opinión! 💕</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {done.published
            ? "Ya está publicada en la página."
            : "La vamos a revisar y publicar en breve."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <div>
        <span className="mb-2 block text-sm font-medium">¿Cómo la pasaste?</span>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              aria-label={`${n} estrella${n > 1 ? "s" : ""}`}
              className="p-0.5"
            >
              <Star
                className={cn(
                  "size-8 transition-colors",
                  (hover || rating) >= n ? "fill-primary text-primary" : "text-muted-foreground",
                )}
              />
            </button>
          ))}
        </div>
      </div>

      {!verified && (
        <div>
          <label className="mb-1 block text-sm font-medium">Tu nombre</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder="Cómo querés que aparezca"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium">Contanos (opcional)</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={1000}
          rows={4}
          placeholder="Qué te gustó, cómo fue la atención…"
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      {siteKey && <Turnstile siteKey={siteKey} onToken={setCaptchaToken} />}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {busy && <Loader2 className="size-4 animate-spin" />}
        Enviar opinión
      </button>
    </form>
  );
}
