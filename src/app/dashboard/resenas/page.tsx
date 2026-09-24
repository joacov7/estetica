import { desc, eq } from "drizzle-orm";
import { Star } from "lucide-react";
import { db } from "@/db";
import { reviews } from "@/db/schema";
import { getCurrentOrg } from "@/features/org/current";
import { getOrgSettings } from "@/lib/settings";
import { Badge } from "@/components/ui/badge";
import { ReviewAdminControls } from "@/features/reviews/review-admin-controls";
import { publicUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  published: "Publicada",
  hidden: "Oculta",
};

export default async function ResenasPage() {
  const { org } = await getCurrentOrg();
  if (!org) return <p className="text-muted-foreground">Todavía no tenés un negocio.</p>;

  const [list, settings] = await Promise.all([
    db.select().from(reviews).where(eq(reviews.organizationId, org.id)).orderBy(desc(reviews.createdAt)),
    getOrgSettings(org.id),
  ]);

  const publishedList = list.filter((r) => r.status === "published");
  const pendingCount = list.filter((r) => r.status === "pending").length;
  const avg = publishedList.length
    ? publishedList.reduce((s, r) => s + r.rating, 0) / publishedList.length
    : 0;
  const link = publicUrl(`/${org.slug}/opiniones`);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">Reseñas</h1>
        <p className="text-muted-foreground">
          Opiniones de tus clientas. Las públicas aparecen en tu página; las pendientes esperan tu
          aprobación.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Promedio</p>
          <p className="mt-1 flex items-center gap-2 font-display text-2xl font-semibold">
            <Star className="size-5 fill-primary text-primary" />
            {publishedList.length ? avg.toFixed(1) : "—"}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Publicadas</p>
          <p className="mt-1 font-display text-2xl font-semibold">{publishedList.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Pendientes</p>
          <p className="mt-1 font-display text-2xl font-semibold">{pendingCount}</p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Link para compartir:{" "}
        <a href={link} target="_blank" rel="noreferrer" className="text-primary hover:underline">
          {link}
        </a>{" "}
        · También tenés un QR listo para imprimir en la sección <strong>Códigos QR</strong>.
        {!settings.reviewsEnabled && (
          <span className="text-destructive"> Las opiniones están desactivadas en Configuración.</span>
        )}
      </p>

      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {list.map((r) => (
          <div key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{r.authorName}</span>
                <span className="inline-flex">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={`size-3.5 ${n <= r.rating ? "fill-primary text-primary" : "text-muted-foreground/40"}`}
                    />
                  ))}
                </span>
                <Badge variant={r.status === "published" ? "default" : "muted"}>
                  {STATUS_LABEL[r.status] ?? r.status}
                </Badge>
                {r.appointmentId && <Badge variant="muted">Verificada</Badge>}
              </div>
              {r.comment && <p className="mt-1 text-sm text-muted-foreground">{r.comment}</p>}
            </div>
            <ReviewAdminControls id={r.id} status={r.status} isFeatured={r.isFeatured} />
          </div>
        ))}
        {list.length === 0 && (
          <p className="p-6 text-muted-foreground">Todavía no recibiste opiniones.</p>
        )}
      </div>
    </div>
  );
}
