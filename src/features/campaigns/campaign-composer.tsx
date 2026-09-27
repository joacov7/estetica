"use client";

import { useState } from "react";
import { Loader2, Send, CheckCircle2, Mail, MessageCircle, ExternalLink } from "lucide-react";
import { sendCampaign, getWhatsappRecipients, type WhatsappRecipient } from "./actions";
import type { Segment, Channel } from "./recipients";
import { waLink, fillTemplate } from "@/lib/whatsapp";

const SEGMENTS: { value: Segment; label: string }[] = [
  { value: "all", label: "Todas las clientas" },
  { value: "inactive", label: "Hace tiempo que no vienen" },
  { value: "birthday_month", label: "Cumpleañeras del mes" },
];

export function CampaignComposer({
  emailCounts,
  waCounts,
  emailReady,
  countryCode,
}: {
  emailCounts: Record<Segment, number>;
  waCounts: Record<Segment, number>;
  emailReady: boolean;
  countryCode: string;
}) {
  const [channel, setChannel] = useState<Channel>("email");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [segment, setSegment] = useState<Segment>("all");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ sent: number; total: number } | null>(null);
  const [waList, setWaList] = useState<WhatsappRecipient[] | null>(null);

  const counts = channel === "whatsapp" ? waCounts : emailCounts;
  const recipients = counts[segment] ?? 0;

  function switchChannel(c: Channel) {
    setChannel(c);
    setResult(null);
    setWaList(null);
    setError(null);
  }

  async function submitEmail() {
    if (!subject.trim()) return setError("Escribí un asunto.");
    if (!body.trim()) return setError("Escribí el mensaje.");
    if (recipients === 0) return setError("Ese segmento no tiene destinatarias con email.");
    if (!confirm(`Vas a enviar esta campaña a ${recipients} destinataria(s). ¿Confirmás?`)) return;
    setBusy(true);
    const res = await sendCampaign({ name, subject, body, segment });
    setBusy(false);
    if (res.ok) {
      setResult({ sent: res.sent, total: res.total });
      setName(""); setSubject(""); setBody("");
    } else setError(res.error);
  }

  async function generateWhatsapp() {
    if (!body.trim()) return setError("Escribí el mensaje.");
    if (recipients === 0) return setError("Ese segmento no tiene clientas con teléfono.");
    setBusy(true);
    const res = await getWhatsappRecipients(segment);
    setBusy(false);
    if (res.ok) setWaList(res.recipients);
    else setError(res.error);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (channel === "email") await submitEmail();
    else await generateWhatsapp();
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="font-display text-lg font-semibold">Nueva campaña</h2>

      {/* Channel selector */}
      <div className="inline-flex rounded-xl border border-border p-1">
        {([["email", "Email", Mail], ["whatsapp", "WhatsApp", MessageCircle]] as const).map(
          ([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              onClick={() => switchChannel(value)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                channel === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-4" /> {label}
            </button>
          ),
        )}
      </div>

      {channel === "email" && !emailReady && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          Para enviar emails hay que configurar Resend (RESEND_API_KEY). Podés dejar la campaña
          escrita, pero el envío estará deshabilitado hasta entonces.
        </p>
      )}
      {channel === "whatsapp" && (
        <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
          WhatsApp gratis no permite envío masivo automático. Generamos la lista y abrís cada chat con
          el mensaje ya escrito (un toque por clienta). Usá <code>{"{nombre}"}</code> para personalizar.
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
            onChange={(e) => { setSegment(e.target.value as Segment); setWaList(null); }}
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

      {channel === "email" && (
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
      )}

      <div>
        <label className="mb-1 block text-sm font-medium">Mensaje</label>
        <textarea
          value={body}
          onChange={(e) => { setBody(e.target.value); setWaList(null); }}
          rows={6}
          maxLength={5000}
          placeholder={
            channel === "email"
              ? "Escribí tu mensaje. Se agrega un saludo con el nombre, un botón para reservar y el link para darse de baja."
              : "Hola {nombre}! Esta semana tenemos 20% off en kapping 💅 ¿Reservamos?"
          }
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{recipients} destinataria(s)</span>
        <button
          type="submit"
          disabled={busy || (channel === "email" && !emailReady)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          {channel === "email" ? "Enviar campaña" : "Generar lista"}
        </button>
      </div>

      {channel === "whatsapp" && waList && (
        <div className="space-y-2 border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">
            {waList.length} chat(s). Tocá cada botón para abrir WhatsApp con el mensaje listo:
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {waList.map((r) => {
              const url = waLink(r.phone, fillTemplate(body, r.name), countryCode);
              return url ? (
                <a
                  key={r.id}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm hover:border-primary/40"
                >
                  <span className="truncate">{r.name}</span>
                  <MessageCircle className="size-4 shrink-0 text-emerald-600" />
                </a>
              ) : (
                <span key={r.id} className="inline-flex items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
                  {r.name} · teléfono inválido
                </span>
              );
            })}
          </div>
        </div>
      )}
      {channel === "whatsapp" && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <ExternalLink className="size-3" /> Se abre WhatsApp Web o la app en otra pestaña.
        </p>
      )}
    </form>
  );
}
