"use client";

import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPack } from "./pack-actions";

type Option = { id: string; name: string };

export function PackForm({ services }: { services: Option[] }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({ name: "", serviceId: "", quantity: "4", price: "" });

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await createPack({ name: f.name, serviceId: f.serviceId, quantity: Number(f.quantity), price: Number(f.price) });
    setSaving(false);
    if (res.ok) { setF({ name: "", serviceId: "", quantity: "4", price: "" }); setOpen(false); }
    else setError(res.error);
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Nuevo pack
      </Button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Nombre</Label>
          <Input value={f.name} onChange={set("name")} placeholder="Pack x4 Kapping" />
        </div>
        <div className="space-y-1.5">
          <Label>Servicio (opcional)</Label>
          <select value={f.serviceId} onChange={set("serviceId")} className="flex h-11 w-full rounded-xl border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value="">Cualquiera</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Cantidad</Label>
          <Input value={f.quantity} onChange={set("quantity")} inputMode="numeric" />
        </div>
        <div className="space-y-1.5">
          <Label>Precio del pack</Label>
          <Input value={f.price} onChange={set("price")} inputMode="numeric" placeholder="85000" />
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
