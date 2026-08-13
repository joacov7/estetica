"use client";

import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateOrgProfile } from "./actions";

type OrgData = {
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  instagram: string | null;
  whatsapp: string | null;
  timezone: string;
  currency: string;
  locale: string;
};

const TIMEZONES = [
  "America/Argentina/Buenos_Aires",
  "America/Montevideo",
  "America/Santiago",
  "America/Bogota",
  "America/Mexico_City",
  "America/Lima",
  "Europe/Madrid",
];
const CURRENCIES = ["ARS", "USD", "UYU", "CLP", "COP", "MXN", "PEN", "EUR"];
const LOCALES = ["es-AR", "es-UY", "es-CL", "es-CO", "es-MX", "es-PE", "es-ES", "es"];

export function OrgProfileForm({ org }: { org: OrgData }) {
  const [f, setF] = useState({
    name: org.name,
    slug: org.slug,
    description: org.description ?? "",
    address: org.address ?? "",
    instagram: org.instagram ?? "",
    whatsapp: org.whatsapp ?? "",
    timezone: org.timezone,
    currency: org.currency,
    locale: org.locale,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setF((prev) => ({ ...prev, [k]: e.target.value }));
    setSaved(false);
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await updateOrgProfile(f);
    setSaving(false);
    if (res.ok) setSaved(true);
    else setError(res.error);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="font-display text-lg font-semibold">Datos del negocio</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre">
          <Input value={f.name} onChange={set("name")} />
        </Field>
        <Field label="Link público (slug)">
          <Input value={f.slug} onChange={set("slug")} placeholder="mi-negocio" />
        </Field>
      </div>

      <Field label="Descripción">
        <Input value={f.description} onChange={set("description")} placeholder="Estudio de manicura y estética..." />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Dirección">
          <Input value={f.address} onChange={set("address")} />
        </Field>
        <Field label="Instagram">
          <Input value={f.instagram} onChange={set("instagram")} placeholder="@tu.estudio" />
        </Field>
        <Field label="WhatsApp">
          <Input value={f.whatsapp} onChange={set("whatsapp")} placeholder="5491100000000" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Zona horaria">
          <Select value={f.timezone} onChange={set("timezone")} options={TIMEZONES} />
        </Field>
        <Field label="Moneda">
          <Select value={f.currency} onChange={set("currency")} options={CURRENCIES} />
        </Field>
        <Field label="Idioma/formato">
          <Select value={f.locale} onChange={set("locale")} options={LOCALES} />
        </Field>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />} Guardar cambios
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={onChange}
      className="flex h-11 w-full rounded-xl border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {options.includes(value) ? null : <option value={value}>{value}</option>}
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
