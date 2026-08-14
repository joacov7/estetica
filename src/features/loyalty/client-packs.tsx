"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sellPack, usePack } from "./pack-actions";

type Template = { id: string; name: string; quantity: number };
type ClientPack = { id: string; name: string; remainingQty: number; totalQty: number };

export function ClientPacks({
  clientId,
  templates,
  packs,
}: {
  clientId: string;
  templates: Template[];
  packs: ClientPack[];
}) {
  const router = useRouter();
  const [packId, setPackId] = useState("");
  const [selling, setSelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function sell() {
    if (!packId) return;
    setSelling(true);
    setError(null);
    const res = await sellPack(packId, clientId);
    setSelling(false);
    if (res.ok) { setPackId(""); router.refresh(); }
    else setError(res.error);
  }

  function use(id: string) {
    start(async () => { await usePack(id); router.refresh(); });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <ul className="space-y-2">
        {packs.map((p) => (
          <li key={p.id} className="flex items-center justify-between rounded-xl bg-muted/60 p-3 text-sm">
            <div>
              <p className="font-medium">{p.name}</p>
              <p className="text-xs text-muted-foreground">Quedan {p.remainingQty} de {p.totalQty}</p>
            </div>
            <Button size="sm" variant="outline" disabled={pending || p.remainingQty === 0} onClick={() => use(p.id)}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : "Usar 1"}
            </Button>
          </li>
        ))}
        {packs.length === 0 && <li className="text-sm text-muted-foreground">Sin packs activos.</li>}
      </ul>

      {templates.length > 0 && (
        <div className="flex items-center gap-2 border-t border-border pt-3">
          <select value={packId} onChange={(e) => setPackId(e.target.value)} className="flex h-10 flex-1 rounded-xl border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value="">Vender un pack…</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <Button size="sm" disabled={!packId || selling} onClick={sell}>
            {selling ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Vender
          </Button>
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
