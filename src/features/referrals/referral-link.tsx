"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

/** Shows a client's referral code + shareable booking link with copy. */
export function ReferralLink({ slug, code }: { slug: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState(`/${slug}/reservar?ref=${code}`);

  if (typeof window !== "undefined" && !url.startsWith("http")) {
    setUrl(`${window.location.origin}/${slug}/reservar?ref=${code}`);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">Código</span>
        <code className="rounded-lg bg-muted px-2 py-1 text-sm font-medium">{code}</code>
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-lg bg-muted px-3 py-2 text-xs">{url}</code>
        <button onClick={copy} className={buttonVariants({ variant: "outline", size: "sm" })}>
          {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  );
}
