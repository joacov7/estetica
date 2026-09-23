"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadImage, removeImage } from "./actions";

type Target = "org-logo" | "org-cover" | "service" | "professional";

export function ImageUploader({
  target,
  targetId = null,
  currentUrl,
  shape = "square",
  label,
}: {
  target: Target;
  targetId?: string | null;
  currentUrl?: string | null;
  shape?: "square" | "wide" | "circle";
  label?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const box =
    shape === "wide" ? "aspect-[3/1] w-full" : shape === "circle" ? "size-20 rounded-full" : "size-20 rounded-xl";
  const radius = shape === "circle" ? "rounded-full" : shape === "wide" ? "rounded-2xl" : "rounded-xl";

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("target", target);
    if (targetId) fd.set("targetId", targetId);
    const res = await uploadImage(fd);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    if (res.ok) router.refresh();
    else setError(res.error);
  }

  async function onRemove() {
    setBusy(true);
    await removeImage(target, targetId);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className={shape === "wide" ? "space-y-2" : "flex items-center gap-3"}>
      <div className={cn("relative overflow-hidden border border-border bg-secondary/40", box, radius)}>
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={currentUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ImagePlus className="size-6" />
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        )}
        {currentUrl && !busy && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Quitar imagen"
            className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-muted-foreground shadow hover:text-destructive"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      <div className={shape === "wide" ? "" : "flex flex-col gap-1"}>
        {label && <span className="text-sm font-medium">{label}</span>}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="text-sm font-medium text-primary hover:underline disabled:opacity-50"
        >
          {currentUrl ? "Cambiar" : "Subir imagen"}
        </button>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
      <input ref={inputRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
    </div>
  );
}
