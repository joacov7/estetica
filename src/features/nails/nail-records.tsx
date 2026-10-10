"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { Loader2, Plus, Trash2, Sparkles } from "lucide-react";
import { createNailRecord, deleteNailRecord } from "./actions";
import { ImageUploader } from "@/features/media/image-uploader";

export interface NailRecord {
  id: string;
  shape: string | null;
  length: string | null;
  color: string | null;
  design: string | null;
  technique: string | null;
  product: string | null;
  observations: string | null;
  photoBeforeUrl: string | null;
  photoAfterUrl: string | null;
  createdAt: string;
}

const FIELDS: { key: keyof NailRecord; label: string; placeholder: string }[] = [
  { key: "shape", label: "Forma", placeholder: "Almendra, cuadrada…" },
  { key: "length", label: "Largo", placeholder: "Corto, medio, largo…" },
  { key: "color", label: "Color / esmalte", placeholder: "Nude 302, rojo…" },
  { key: "technique", label: "Técnica", placeholder: "Kapping, soft gel…" },
  { key: "design", label: "Diseño", placeholder: "Francesa, nail art…" },
  { key: "product", label: "Producto / marca", placeholder: "Gel X marca…" },
];

const EMPTY = { shape: "", length: "", color: "", technique: "", design: "", product: "", observations: "" };

export function NailRecords({
  clientId,
  records,
  blobConfigured,
  timezone,
}: {
  clientId: string;
  records: NailRecord[];
  blobConfigured: boolean;
  timezone: string;
}) {
  const router = useRouter();
  const tzFormat = (iso: string) => formatInTimeZone(iso, timezone, "dd/MM/yy");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!Object.values(form).some((v) => v.trim())) {
      return setError("Completá al menos un campo.");
    }
    setSaving(true);
    setError(null);
    const res = await createNailRecord({ clientId, ...form });
    setSaving(false);
    if (res.ok) {
      setForm({ ...EMPTY });
      setOpen(false);
      router.refresh();
    } else setError(res.error);
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar esta ficha?")) return;
    await deleteNailRecord(id, clientId);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium hover:border-primary/40"
        >
          <Plus className="size-4" /> Agregar ficha
        </button>
      ) : (
        <form onSubmit={submit} className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{f.label}</label>
                <input
                  value={(form as Record<string, string>)[f.key] ?? ""}
                  onChange={(e) => set(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
                />
              </div>
            ))}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Observaciones</label>
            <textarea
              value={form.observations}
              onChange={(e) => set("observations", e.target.value)}
              rows={2}
              placeholder="Alergias, preferencias, cómo quedó…"
              className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Guardar ficha
            </button>
            <button type="button" onClick={() => { setOpen(false); setError(null); }} className="text-sm text-muted-foreground hover:text-foreground">
              Cancelar
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Guardá la ficha y después vas a poder subir las fotos de antes/después.</p>
        </form>
      )}

      <ul className="space-y-3">
        {records.map((r) => {
          const details = FIELDS.map((f) => ({ label: f.label, value: r[f.key] as string | null })).filter((d) => d.value);
          return (
            <li key={r.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-muted-foreground">{tzFormat(r.createdAt)}</p>
                <button onClick={() => remove(r.id)} aria-label="Eliminar ficha" className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="size-4" />
                </button>
              </div>

              {details.length > 0 ? (
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  {details.map((d) => (
                    <div key={d.label} className="flex gap-1">
                      <dt className="text-muted-foreground">{d.label}:</dt>
                      <dd className="font-medium">{d.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mt-2 inline-flex items-center gap-1 text-sm text-muted-foreground"><Sparkles className="size-3.5" /> Ficha</p>
              )}

              {r.observations && <p className="mt-2 text-sm text-muted-foreground">{r.observations}</p>}

              {blobConfigured ? (
                <div className="mt-3 flex gap-4">
                  <div className="text-center">
                    <span className="mb-1 block text-xs text-muted-foreground">Antes</span>
                    <ImageUploader target="nail-before" targetId={r.id} currentUrl={r.photoBeforeUrl} shape="square" />
                  </div>
                  <div className="text-center">
                    <span className="mb-1 block text-xs text-muted-foreground">Después</span>
                    <ImageUploader target="nail-after" targetId={r.id} currentUrl={r.photoAfterUrl} shape="square" />
                  </div>
                </div>
              ) : (
                (r.photoBeforeUrl || r.photoAfterUrl) && (
                  <div className="mt-3 flex gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {r.photoBeforeUrl && <img src={r.photoBeforeUrl} alt="Antes" className="size-20 rounded-xl object-cover" />}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {r.photoAfterUrl && <img src={r.photoAfterUrl} alt="Después" className="size-20 rounded-xl object-cover" />}
                  </div>
                )
              )}
            </li>
          );
        })}
        {records.length === 0 && !open && (
          <li className="text-sm text-muted-foreground">Sin fichas técnicas todavía.</li>
        )}
      </ul>
    </div>
  );
}
