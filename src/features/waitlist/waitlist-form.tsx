"use client";

import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addWaitlistEntry } from "./actions";

type Option = { id: string; name: string };

export function WaitlistForm({ services, professionals }: { services: Option[]; professionals: Option[] }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({ name: "", phone: "", serviceId: "", professionalId: "", desiredDate: "", timeFrom: "", timeTo: "" });

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await addWaitlistEntry(f);
    setSaving(false);
    if (res.ok) {
      setF({ name: "", phone: "", serviceId: "", professionalId: "", desiredDate: "", timeFrom: "", timeTo: "" });
      setOpen(false);
    } else setError(res.error);
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Agregar a la lista
      </Button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre"><Input value={f.name} onChange={set("name")} /></Field>
        <Field label="WhatsApp"><Input value={f.phone} onChange={set("phone")} inputMode="tel" /></Field>
        <Field label="Servicio (opcional)">
          <Select value={f.serviceId} onChange={set("serviceId")} placeholder="Cualquiera" options={services} />
        </Field>
        <Field label="Profesional (opcional)">
          <Select value={f.professionalId} onChange={set("professionalId")} placeholder="Cualquiera" options={professionals} />
        </Field>
        <Field label="Día deseado (opcional)"><Input type="date" value={f.desiredDate} onChange={set("desiredDate")} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Desde"><Input type="time" value={f.timeFrom} onChange={set("timeFrom")} /></Field>
          <Field label="Hasta"><Input type="time" value={f.timeTo} onChange={set("timeTo")} /></Field>
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <div className="mt-4 flex gap-2">
        <Button type="submit" disabled={saving}>{saving && <Loader2 className="size-4 animate-spin" />} Guardar</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function Select({ value, onChange, options, placeholder }: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: Option[];
  placeholder: string;
}) {
  return (
    <select value={value} onChange={onChange} className="flex h-11 w-full rounded-xl border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  );
}
