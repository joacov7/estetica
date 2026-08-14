"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { togglePack } from "./pack-actions";

export function PackToggle({ id, isActive }: { id: string; isActive: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      aria-label={isActive ? "Desactivar" : "Activar"}
      onClick={() => start(() => void togglePack(id, !isActive))}
      disabled={pending}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isActive ? "bg-primary" : "bg-muted"}`}
    >
      {pending ? (
        <Loader2 className="mx-auto size-3 animate-spin text-white" />
      ) : (
        <span className={`inline-block size-4 transform rounded-full bg-white transition-transform ${isActive ? "translate-x-6" : "translate-x-1"}`} />
      )}
    </button>
  );
}
