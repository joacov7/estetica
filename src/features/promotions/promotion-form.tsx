"use client";

import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPromotion } from "./actions";

export function PromotionForm() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountValue, setDiscountValue] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await createPromotion({ name, code, discountType, discountValue: Number(discountValue) });
    setSaving(false);
    if (res.ok) {
      setName(""); setCode(""); setDiscountValue(""); setOpen(false);
    } else setError(res.error);
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Nueva promoción
      </Button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Nombre</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Martes de descuento" />
        </div>
        <div className="space-y-1.5">
          <Label>Código (opcional)</Label>
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="MARTES15" />
        </div>
        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <select
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as "percentage" | "fixed")}
            className="flex h-11 w-full rounded-xl border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="percentage">Porcentaje</option>
            <option value="fixed">Monto fijo</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>{discountType === "percentage" ? "Descuento (%)" : "Descuento ($)"}</Label>
          <Input value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} inputMode="numeric" placeholder={discountType === "percentage" ? "15" : "3000"} />
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <div className="mt-4 flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />} Guardar
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
      </div>
    </form>
  );
}
