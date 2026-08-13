import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Phone, Mail, Cake } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { clients, appointments, appointmentServices, clientNotes } from "@/db/schema";
import { getCurrentOrg } from "@/features/org/current";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";
import { NoteForm } from "@/features/clients/note-form";
import type { AppointmentStatus } from "@/db/schema";

export const dynamic = "force-dynamic";

const STATUS: Record<AppointmentStatus, { label: string; variant: "default" | "muted" | "gold" | "outline" }> = {
  reservado: { label: "Reservado", variant: "default" },
  confirmado: { label: "Confirmado", variant: "gold" },
  atendido: { label: "Atendido", variant: "muted" },
  cancelado: { label: "Cancelado", variant: "outline" },
  no_show: { label: "No vino", variant: "outline" },
};

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { org } = await getCurrentOrg();
  if (!org) notFound();

  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, id), eq(clients.organizationId, org.id)))
    .limit(1);
  if (!client) notFound();

  const [appts, notes] = await Promise.all([
    db
      .select({
        id: appointments.id,
        startAt: appointments.startAt,
        status: appointments.status,
      })
      .from(appointments)
      .where(and(eq(appointments.clientId, id), eq(appointments.organizationId, org.id)))
      .orderBy(desc(appointments.startAt)),
    db
      .select({ id: clientNotes.id, body: clientNotes.body, createdAt: clientNotes.createdAt })
      .from(clientNotes)
      .where(eq(clientNotes.clientId, id))
      .orderBy(desc(clientNotes.createdAt)),
  ]);

  // Services + price per appointment.
  const svcByAppt = new Map<string, { names: string[]; total: number }>();
  if (appts.length > 0) {
    const rows = await db
      .select({
        appointmentId: appointmentServices.appointmentId,
        name: appointmentServices.name,
        priceCents: appointmentServices.priceCents,
      })
      .from(appointmentServices)
      .where(inArray(appointmentServices.appointmentId, appts.map((a) => a.id)));
    for (const r of rows) {
      const e = svcByAppt.get(r.appointmentId) ?? { names: [], total: 0 };
      e.names.push(r.name);
      e.total += r.priceCents;
      svcByAppt.set(r.appointmentId, e);
    }
  }

  const currency = { currency: org.currency, locale: org.locale };
  const attended = appts.filter((a) => a.status === "atendido");
  const totalSpent = attended.reduce((s, a) => s + (svcByAppt.get(a.id)?.total ?? 0), 0);

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/clientes"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Clientes
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-14 items-center justify-center rounded-full bg-secondary font-display text-2xl text-secondary-foreground">
            {client.name.charAt(0)}
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold">{client.name}</h1>
            <div className="mt-1 flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Phone className="size-3.5" /> {client.phone}</span>
              {client.email && <span className="inline-flex items-center gap-1"><Mail className="size-3.5" /> {client.email}</span>}
              {client.birthday && <span className="inline-flex items-center gap-1"><Cake className="size-3.5" /> {client.birthday}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-6 text-center">
          <div>
            <p className="font-display text-2xl font-semibold">{attended.length}</p>
            <p className="text-xs text-muted-foreground">visitas</p>
          </div>
          <div>
            <p className="font-display text-2xl font-semibold">{formatMoney(totalSpent, currency)}</p>
            <p className="text-xs text-muted-foreground">gastado</p>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* History */}
        <div className="lg:col-span-2">
          <h2 className="mb-3 font-display text-lg font-semibold">Historial de turnos</h2>
          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {appts.map((a) => {
              const s = svcByAppt.get(a.id);
              return (
                <div key={a.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-medium">
                      {formatInTimeZone(a.startAt, org.timezone, "dd/MM/yy HH:mm")}
                    </p>
                    <p className="text-sm text-muted-foreground">{s?.names.join(", ") ?? "—"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {s && s.total > 0 && (
                      <span className="text-sm text-muted-foreground">{formatMoney(s.total, currency)}</span>
                    )}
                    <Badge variant={STATUS[a.status].variant}>{STATUS[a.status].label}</Badge>
                  </div>
                </div>
              );
            })}
            {appts.length === 0 && <p className="p-6 text-muted-foreground">Sin turnos todavía.</p>}
          </div>
        </div>

        {/* Notes */}
        <div>
          <h2 className="mb-3 font-display text-lg font-semibold">Notas</h2>
          <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <NoteForm clientId={client.id} />
            <ul className="space-y-2">
              {notes.map((n) => (
                <li key={n.id} className="rounded-xl bg-muted/60 p-3 text-sm">
                  <p>{n.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatInTimeZone(n.createdAt, org.timezone, "dd/MM/yy")}
                  </p>
                </li>
              ))}
              {notes.length === 0 && <li className="text-sm text-muted-foreground">Sin notas.</li>}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
