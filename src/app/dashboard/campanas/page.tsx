import { desc, eq } from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/db";
import { campaigns } from "@/db/schema";
import { getCurrentOrg } from "@/features/org/current";
import { emailConfigured } from "@/services/notifications/email";
import { segmentCounts, SEGMENT_LABEL, type Segment } from "@/features/campaigns/recipients";
import { CampaignComposer } from "@/features/campaigns/campaign-composer";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function CampanasPage() {
  const { org } = await getCurrentOrg();
  if (!org) return <p className="text-muted-foreground">Todavía no tenés un negocio.</p>;

  const [counts, history] = await Promise.all([
    segmentCounts(org.id),
    db.select().from(campaigns).where(eq(campaigns.organizationId, org.id)).orderBy(desc(campaigns.createdAt)).limit(30),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">Campañas</h1>
        <p className="text-muted-foreground">
          Enviá novedades y promos por email a tus clientas. Solo se envía a quienes tienen email
          cargado y no se dieron de baja.
        </p>
      </header>

      <CampaignComposer counts={counts} emailReady={emailConfigured} />

      <div>
        <h2 className="mb-3 font-display text-lg font-semibold">Historial</h2>
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {history.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="truncate font-medium">{c.name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {c.subject} · {SEGMENT_LABEL[c.segment as Segment] ?? c.segment}
                </p>
                {c.sentAt && (
                  <p className="text-xs text-muted-foreground">
                    {formatInTimeZone(c.sentAt, org.timezone, "dd/MM/yyyy HH:mm")}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <Badge variant={c.status === "sent" ? "default" : "muted"}>
                  {c.status === "sent" ? "Enviada" : "Borrador"}
                </Badge>
                {c.status === "sent" && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {c.sentCount}/{c.recipientCount} enviados
                  </p>
                )}
              </div>
            </div>
          ))}
          {history.length === 0 && (
            <p className="p-6 text-muted-foreground">Todavía no enviaste campañas.</p>
          )}
        </div>
      </div>
    </div>
  );
}
