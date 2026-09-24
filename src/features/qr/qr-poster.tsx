"use client";

import { useId } from "react";
import { Printer } from "lucide-react";

/**
 * A printable QR poster card. Clicking "Imprimir" isolates this card for the
 * print dialog (hides everything else via an injected print stylesheet), so it
 * prints clean regardless of the surrounding dashboard chrome.
 */
export function QrPoster({
  title,
  subtitle,
  svg,
  url,
  brand,
  footer,
}: {
  title: string;
  subtitle: string;
  svg: string;
  url: string;
  brand: string;
  footer?: string;
}) {
  const rawId = useId();
  const id = "poster-" + rawId.replace(/[^a-zA-Z0-9]/g, "");

  function print() {
    const style = document.createElement("style");
    style.setAttribute("data-print-poster", id);
    style.textContent = `@media print {
      body * { visibility: hidden !important; }
      #${id}, #${id} * { visibility: visible !important; }
      #${id} { position: fixed; inset: 0; margin: auto; width: 100%; max-width: 620px; box-shadow: none !important; border: none !important; }
      #${id} .no-print { display: none !important; }
    }`;
    document.head.appendChild(style);
    window.print();
    setTimeout(() => style.remove(), 500);
  }

  return (
    <div
      id={id}
      className="flex flex-col items-center rounded-3xl border border-border bg-white p-8 text-center shadow-sm"
    >
      <p className="font-display text-2xl font-semibold text-[#a24e6b]">{brand}</p>
      <h3 className="mt-4 font-display text-3xl font-bold text-[#1f1f23]">{title}</h3>
      <p className="mt-1 max-w-[22rem] text-[#6b6b70]">{subtitle}</p>

      <div
        className="mt-6 rounded-2xl border border-[#f0e6ea] bg-white p-4 [&_svg]:h-56 [&_svg]:w-56"
        // QR SVG generated server-side with the qrcode package (no network).
        dangerouslySetInnerHTML={{ __html: svg }}
      />

      <p className="mt-4 text-sm text-[#9a9aa0]">Escaneá con la cámara del celular</p>
      {footer && <p className="mt-1 text-sm font-medium text-[#a24e6b]">{footer}</p>}
      <p className="mt-2 break-all text-xs text-[#c4b5bd]">{url}</p>

      <button
        onClick={print}
        className="no-print mt-6 inline-flex items-center gap-2 rounded-xl bg-[#a24e6b] px-4 py-2 text-sm font-medium text-white hover:bg-[#8f4560]"
      >
        <Printer className="size-4" /> Imprimir
      </button>
    </div>
  );
}
