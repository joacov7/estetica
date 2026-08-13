"use client";

import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createService } from "./actions";

/** Inline create-service form. Uses the createService server action. */
export function ServiceForm() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [durationMin, setDurationMin] = useState("60");
  const [bufferMin, setBufferMin] = useState("10");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await createService({
      name,
      price: Number(price),
      durationMin: Number(durationMin),
      bufferMin: Number(bufferMin),
      depositType: "none",
      depositValue: 0,
      isActive: true,
    });
    setSaving(false);
    if (res.ok) {
      setName("");
      setPrice("");
      setOpen(false);
    } else {
      setError(res.error);
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Nuevo servicio
      </Button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="s-name">Nombre</Label>
          <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Kapping" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-price">Precio</Label>
          <Input id="s-price" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="25000" inputMode="numeric" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-dur">Duración (min)</Label>
          <Input id="s-dur" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} inputMode="numeric" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-buf">Buffer (min)</Label>
          <Input id="s-buf" value={bufferMin} onChange={(e) => setBufferMin(e.target.value)} inputMode="numeric" />
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <div className="mt-4 flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />} Guardar
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
