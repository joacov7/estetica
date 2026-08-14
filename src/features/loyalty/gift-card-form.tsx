"use client";

import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createGiftCard } from "./gift-card-actions";

export function GiftCardForm() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await createGiftCard({ amount: Number(amount), code, note });
    setSaving(false);
    if (res.ok) {
      setAmount(""); setCode(""); setNote(""); setOpen(false);
    } else setError(res.error);
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Nueva gift card
      </Button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Monto</Label>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="50000" />
        </div>
        <div className="space-y-1.5">
          <Label>Código (opcional)</Label>
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Automático" />
        </div>
        <div className="space-y-1.5">
          <Label>Nota (opcional)</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Regalo de Sofi" />
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <div className="mt-4 flex gap-2">
        <Button type="submit" disabled={saving}>{saving && <Loader2 className="size-4 animate-spin" />} Crear</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
      </div>
    </form>
  );
}
