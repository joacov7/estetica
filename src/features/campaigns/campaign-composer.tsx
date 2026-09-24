"use client";

import { useState } from "react";
import { Loader2, Send, CheckCircle2 } from "lucide-react";
import { sendCampaign } from "./actions";
import type { Segment } from "./recipients";

const SEGMENTS: { value: Segment; label: string }[] = [
  { value: "all", label: "Todas las clientas" },
  { value: "inactive", label: "Hace tiempo que no vienen" },
  { value: "birthday_month", label: "Cumpleañeras del mes" },
];

export function CampaignComposer({ counts, emailReady }: { counts: Record<Segment, number>; emailReady: boolean }) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [segment, setSegment] = useState<Segment>("all");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ sent: number; total: number } | null>(null);

  const recipients = counts[segment] ?? 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!subject.trim()) return setError("Escribí un asunto.");
    if (!body.trim()) return setError("Escribí el mensaje.");
    if (recipients === 0) return setError("Ese segmento no tiene destinatarias con email.");
    if (!confirm(`Vas a enviar esta campaña a ${recipients} destinataria(s). ¿Confirmás?`)) return;
    setBusy(true);
    const res = await sendCampaign({ name, subject, body, segment });
    setBusy(false);
    if (res.ok) {
      setResult({ sent: res.sent, total: res.total });
      setName("");
      setSubject("");
      setBody("");
    } else setError(res.error);
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="font-display text-lg font-semibold">Nueva campaña</h2>

      {!emailReady && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          Para enviar emails hay que configurar Resend (RESEND_API_KEY). Podés dejar la campaña
          escrita, pero el envío estará deshabilitado hasta entonces.
        </p>
      )}

      {result && (
        <p className="flex items-center gap-2 rounded-xl bg-primary/10 p-3 text-sm text-primary">
          <CheckCircle2 className="size-4" /> Enviada a {result.sent} de {result.total} destinatarias.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Nombre interno</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Promo de septiembre"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">¿A quién?</label>
          <select
            value={segment}
            onChange={(e) => setSegment(e.target.value as Segment)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          >
            {SEGMENTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label} ({counts[s.value] ?? 0})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Asunto</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={160}
          placeholder="Ej: 20% off en kapping esta semana 💅"
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Mensaje</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          maxLength={5000}
          placeholder="Escribí tu mensaje. Se agrega automáticamente un saludo con el nombre, un botón para reservar y el link para darse de baja."
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{recipients} destinataria(s)</span>
        <button
          type="submit"
          disabled={busy || !emailReady}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Enviar campaña
        </button>
      </div>
    </form>
  );
}
