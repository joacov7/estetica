"use client";

import { useState } from "react";
import { Pencil, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateService } from "./actions";
import type { DepositType } from "@/db/schema";

export type EditableService = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  durationMin: number;
  bufferMin: number;
  depositType: DepositType;
  depositValue: number;
  isActive: boolean;
};

export function EditServiceDialog({ service }: { service: EditableService }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({
    name: service.name,
    description: service.description ?? "",
    price: String(service.priceCents / 100),
    durationMin: String(service.durationMin),
    bufferMin: String(service.bufferMin),
    depositType: service.depositType,
    // Fixed deposit is stored in cents; show it in pesos.
    depositValue: String(service.depositType === "fixed" ? service.depositValue / 100 : service.depositValue),
  });

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await updateService(service.id, {
      name: f.name,
      description: f.description,
      price: Number(f.price),
      durationMin: Number(f.durationMin),
      bufferMin: Number(f.bufferMin),
      depositType: f.depositType as DepositType,
      depositValue: Number(f.depositValue),
      isActive: service.isActive,
    });
    setSaving(false);
    if (res.ok) setOpen(false);
    else setError(res.error);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Editar"
        className="text-muted-foreground hover:text-foreground"
      >
        <Pencil className="size-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <form onSubmit={save} className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-card p-6 shadow-xl sm:rounded-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">Editar servicio</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-4">
              <Field label="Nombre">
                <Input value={f.name} onChange={set("name")} />
              </Field>
              <Field label="Descripción">
                <Input value={f.description} onChange={set("description")} />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Precio">
                  <Input value={f.price} onChange={set("price")} inputMode="numeric" />
                </Field>
                <Field label="Duración (min)">
                  <Input value={f.durationMin} onChange={set("durationMin")} inputMode="numeric" />
                </Field>
                <Field label="Buffer (min)">
                  <Input value={f.bufferMin} onChange={set("bufferMin")} inputMode="numeric" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tipo de seña">
                  <select
                    value={f.depositType}
                    onChange={set("depositType")}
                    className="flex h-11 w-full rounded-xl border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="none">Sin seña</option>
                    <option value="fixed">Monto fijo</option>
                    <option value="percentage">Porcentaje</option>
                  </select>
                </Field>
                <Field label={f.depositType === "percentage" ? "Seña (%)" : "Seña ($)"}>
                  <Input
                    value={f.depositValue}
                    onChange={set("depositValue")}
                    inputMode="numeric"
                    disabled={f.depositType === "none"}
                  />
                </Field>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="size-4 animate-spin" />} Guardar
                </Button>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          </form>
        </div>
      )}
    </>
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
