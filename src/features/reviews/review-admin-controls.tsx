"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, EyeOff, Star, Trash2 } from "lucide-react";
import { setReviewStatus, toggleReviewFeatured, deleteReview } from "./admin-actions";

export function ReviewAdminControls({
  id,
  status,
  isFeatured,
}: {
  id: string;
  status: string;
  isFeatured: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<unknown>) => start(async () => {
    await fn();
    router.refresh();
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status !== "published" && (
        <button
          onClick={() => run(() => setReviewStatus(id, "published"))}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
        >
          <Check className="size-3.5" /> Publicar
        </button>
      )}
      {status !== "hidden" && (
        <button
          onClick={() => run(() => setReviewStatus(id, "hidden"))}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/70 disabled:opacity-50"
        >
          <EyeOff className="size-3.5" /> Ocultar
        </button>
      )}
      {status === "published" && (
        <button
          onClick={() => run(() => toggleReviewFeatured(id, !isFeatured))}
          disabled={pending}
          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
            isFeatured ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground hover:bg-muted/70"
          }`}
        >
          <Star className={`size-3.5 ${isFeatured ? "fill-amber-500 text-amber-500" : ""}`} />
          {isFeatured ? "Destacada" : "Destacar"}
        </button>
      )}
      <button
        onClick={() => {
          if (confirm("¿Eliminar esta opinión?")) run(() => deleteReview(id));
        }}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
