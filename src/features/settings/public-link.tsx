"use client";

import { useState } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Shows the public booking URL with copy + open actions. */
export function PublicLink({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState(`/${slug}`);

  // Build the absolute URL on the client from the current origin.
  if (typeof window !== "undefined" && !url.startsWith("http")) {
    setUrl(`${window.location.origin}/${slug}`);
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
    <div className="space-y-3 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="font-display text-lg font-semibold">Tu página pública</h2>
      <p className="text-sm text-muted-foreground">
        Compartí este link en Instagram, WhatsApp o un QR para que reserven turnos.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="flex-1 truncate rounded-lg bg-muted px-3 py-2 text-sm">{url}</code>
        <button onClick={copy} className={buttonVariants({ variant: "outline", size: "sm" })}>
          {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
          {copied ? "Copiado" : "Copiar"}
        </button>
        <a
          href={`/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
        >
          <ExternalLink className="size-4" /> Abrir
        </a>
      </div>
    </div>
  );
}
