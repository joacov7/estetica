"use client";

import { useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { removeWaitlistEntry } from "./actions";

export function RemoveWaitlistButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      aria-label="Quitar"
      onClick={() => start(() => void removeWaitlistEntry(id))}
      disabled={pending}
      className="text-muted-foreground hover:text-destructive disabled:opacity-50"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
    </button>
  );
}
