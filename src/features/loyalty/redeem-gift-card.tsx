"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { redeemGiftCard } from "./gift-card-actions";

/** Small inline "use balance" control for an active gift card. */
export function RedeemGiftCard({ giftCardId }: { giftCardId: string }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function redeem() {
    setBusy(true);
    setError(null);
    const res = await redeemGiftCard({ giftCardId, amount: Number(amount) });
    setBusy(false);
    if (res.ok) {
      setAmount("");
      router.refresh();
    } else setError(res.error);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="Monto" className="h-9 w-28" />
        <Button size="sm" variant="outline" disabled={busy || !amount} onClick={redeem}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : "Usar"}
        </Button>
      </div>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
