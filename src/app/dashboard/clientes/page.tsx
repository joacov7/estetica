import { Phone, Mail } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { and, asc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { clients, appointments } from "@/db/schema";
import { getCurrentOrg } from "@/features/org/current";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const { org } = await getCurrentOrg();
  if (!org) return <p className="text-muted-foreground">Todavía no tenés un negocio.</p>;

  const [list, appts] = await Promise.all([
    db.select().from(clients).where(eq(clients.organizationId, org.id)).orderBy(asc(clients.name)),
    db
      .select({
        clientId: appointments.clientId,
        startAt: appointments.startAt,
        status: appointments.status,
      })
      .from(appointments)
      .where(and(eq(appointments.organizationId, org.id), ne(appointments.status, "cancelado"))),
  ]);

  const nowIso = new Date().toISOString();
  const stats = new Map<string, { count: number; last?: string; next?: string }>();
  for (const a of appts) {
    if (!a.clientId) continue;
    const s = stats.get(a.clientId) ?? { count: 0 };
    s.count += 1;
    if (a.startAt < nowIso) {
      if (!s.last || a.startAt > s.last) s.last = a.startAt;
    } else if (a.status === "reservado" || a.status === "confirmado") {
      if (!s.next || a.startAt < s.next) s.next = a.startAt;
    }
    stats.set(a.clientId, s);
  }

  const fmt = (iso?: string) => (iso ? formatInTimeZone(iso, org.timezone, "dd/MM/yy") : "—");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">Clientes</h1>
        <p className="text-muted-foreground">
          {list.length} {list.length === 1 ? "clienta registrada" : "clientas registradas"}.
        </p>
      </header>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center text-muted-foreground">
          Todavía no hay clientas. Aparecen automáticamente cuando reservan un turno.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-4 font-medium">Clienta</th>
                <th className="p-4 font-medium">Contacto</th>
                <th className="p-4 font-medium">Turnos</th>
                <th className="p-4 font-medium">Última visita</th>
                <th className="p-4 font-medium">Próxima</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => {
                const s = stats.get(c.id);
                return (
                  <tr key={c.id} className="border-b border-border last:border-0">
                    <td className="p-4 font-medium">{c.name}</td>
                    <td className="p-4 text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Phone className="size-3.5" /> {c.phone}
                      </div>
                      {c.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="size-3.5" /> {c.email}
                        </div>
                      )}
                    </td>
                    <td className="p-4">{s?.count ?? 0}</td>
                    <td className="p-4 text-muted-foreground">{fmt(s?.last)}</td>
                    <td className="p-4 text-muted-foreground">{fmt(s?.next)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
