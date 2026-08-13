import { Phone } from "lucide-react";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { waitlist, clients, services, professionals } from "@/db/schema";
import { getCurrentOrg } from "@/features/org/current";
import { WaitlistForm } from "@/features/waitlist/waitlist-form";
import { RemoveWaitlistButton } from "@/features/waitlist/remove-button";

export const dynamic = "force-dynamic";

export default async function ListaEsperaPage() {
  const { org } = await getCurrentOrg();
  if (!org) return <p className="text-muted-foreground">Todavía no tenés un negocio.</p>;

  const [rows, svc, pros] = await Promise.all([
    db
      .select({
        id: waitlist.id,
        phone: waitlist.phone,
        desiredDate: waitlist.desiredDate,
        timeFrom: waitlist.timeFrom,
        timeTo: waitlist.timeTo,
        clientName: clients.name,
        serviceName: services.name,
        proName: professionals.name,
      })
      .from(waitlist)
      .leftJoin(clients, eq(clients.id, waitlist.clientId))
      .leftJoin(services, eq(services.id, waitlist.serviceId))
      .leftJoin(professionals, eq(professionals.id, waitlist.professionalId))
      .where(eq(waitlist.organizationId, org.id))
      .orderBy(desc(waitlist.createdAt)),
    db.select({ id: services.id, name: services.name }).from(services).where(and(eq(services.organizationId, org.id), eq(services.isActive, true))).orderBy(asc(services.sortOrder)),
    db.select({ id: professionals.id, name: professionals.name }).from(professionals).where(and(eq(professionals.organizationId, org.id), eq(professionals.isActive, true))).orderBy(asc(professionals.sortOrder)),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">Lista de espera</h1>
        <p className="text-muted-foreground">Clientas esperando un turno que se libere.</p>
      </header>

      <WaitlistForm services={svc} professionals={pros} />

      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium">{r.clientName ?? "—"}</p>
              <p className="text-sm text-muted-foreground">
                {[r.serviceName ?? "Cualquier servicio", r.proName ?? "Cualquiera"].join(" · ")}
                {r.desiredDate && ` · ${r.desiredDate}`}
                {r.timeFrom && r.timeTo && ` · ${r.timeFrom.slice(0, 5)}–${r.timeTo.slice(0, 5)}`}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <a href={`https://wa.me/${(r.phone ?? "").replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <Phone className="size-3.5" /> {r.phone}
              </a>
              <RemoveWaitlistButton id={r.id} />
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="p-6 text-muted-foreground">La lista de espera está vacía.</p>}
      </div>
    </div>
  );
}
