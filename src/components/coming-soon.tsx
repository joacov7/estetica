import { Sparkles } from "lucide-react";

/** Placeholder for dashboard sections that are planned but not built yet. */
export function ComingSoon({ title, description }: { title: string; description?: string }) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">{title}</h1>
      </header>
      <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-secondary text-primary">
          <Sparkles className="size-6" />
        </div>
        <h2 className="mt-4 font-display text-xl font-semibold">Próximamente</h2>
        <p className="mt-2 max-w-sm text-muted-foreground">
          {description ?? "Esta sección está en construcción y llega en un próximo módulo."}
        </p>
      </div>
    </div>
  );
}
