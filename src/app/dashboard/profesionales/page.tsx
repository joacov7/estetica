import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { professionals } from "@/db/schema";
import { getCurrentOrg } from "@/features/org/current";
import { Badge } from "@/components/ui/badge";
import { ProfessionalForm } from "@/features/professionals/professional-form";
import { ProfessionalToggle } from "@/features/professionals/professional-toggle";

export const dynamic = "force-dynamic";

export default async function ProfesionalesPage() {
  const { org } = await getCurrentOrg();
  if (!org) return <p className="text-muted-foreground">Todavía no tenés un negocio.</p>;

  const list = await db
    .select()
    .from(professionals)
    .where(eq(professionals.organizationId, org.id))
    .orderBy(asc(professionals.sortOrder));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">Profesionales</h1>
        <p className="text-muted-foreground">Quién atiende y qué hace.</p>
      </header>

      <ProfessionalForm />

      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {list.map((p) => (
          <div key={p.id} className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-secondary font-display text-secondary-foreground">
                {p.name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{p.name}</span>
                  {!p.isActive && <Badge variant="muted">Inactiva</Badge>}
                </div>
                {p.specialties.length > 0 && (
                  <p className="text-sm text-muted-foreground">{p.specialties.join(" · ")}</p>
                )}
              </div>
            </div>
            <ProfessionalToggle id={p.id} isActive={p.isActive} />
          </div>
        ))}
        {list.length === 0 && (
          <p className="p-6 text-muted-foreground">Todavía no cargaste profesionales.</p>
        )}
      </div>
    </div>
  );
}
