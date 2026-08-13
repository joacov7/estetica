"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recordPayment } from "./actions";

type Kind = "payment" | "deposit" | "tip" | "refund";
type Method = "cash" | "transfer" | "mercadopago" | "card";

export function PaymentDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>("payment");
  const [method, setMethod] = useState<Method>("cash");
  const [amount, setAmount] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await recordPayment({ kind, method, amount: Number(amount) });
    setSaving(false);
    if (res.ok) {
      setAmount("");
      setOpen(false);
      router.refresh();
    } else {
      setError(res.error);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Registrar movimiento
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <form onSubmit={save} className="w-full max-w-sm rounded-t-2xl bg-card p-6 shadow-xl sm:rounded-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">Nuevo movimiento</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={kind} onChange={(v) => setKind(v as Kind)} options={[
                  { value: "payment", label: "Cobro" },
                  { value: "deposit", label: "Seña" },
                  { value: "tip", label: "Propina" },
                  { value: "refund", label: "Reembolso" },
                ]} />
              </div>
              <div className="space-y-1.5">
                <Label>Método</Label>
                <Select value={method} onChange={(v) => setMethod(v as Method)} options={[
                  { value: "cash", label: "Efectivo" },
                  { value: "transfer", label: "Transferencia" },
                  { value: "mercadopago", label: "Mercado Pago" },
                  { value: "card", label: "Tarjeta" },
                ]} />
              </div>
              <div className="space-y-1.5">
                <Label>Monto</Label>
                <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="25000" />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={saving || !amount}>
                {saving && <Loader2 className="size-4 animate-spin" />} Registrar
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-11 w-full rounded-xl border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
