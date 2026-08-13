import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { professionals, appointments, clients, appointmentServices, services } from "@/db/schema";
import { getCurrentOrg } from "@/features/org/current";
import { buttonVariants } from "@/components/ui/button";
import { AgendaBoard, type AgendaAppointment } from "@/features/agenda/agenda-board";
import { NewAppointmentDialog } from "@/features/agenda/new-appointment-dialog";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { org } = await getCurrentOrg();
  if (!org) return <p className="text-muted-foreground">Todavía no tenés un negocio.</p>;

  const sp = await searchParams;
  const today = formatInTimeZone(new Date(), org.timezone, "yyyy-MM-dd");
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : today;

  const dayRef = fromZonedTime(`${date}T00:00:00`, org.timezone);
  const dayStartIso = dayRef.toISOString();
  const dayEndIso = new Date(dayRef.getTime() + DAY_MS).toISOString();

  const [pros, svc] = await Promise.all([
    db
      .select({ id: professionals.id, name: professionals.name })
      .from(professionals)
      .where(and(eq(professionals.organizationId, org.id), eq(professionals.isActive, true)))
      .orderBy(asc(professionals.sortOrder)),
    db
      .select({ id: services.id, name: services.name, durationMin: services.durationMin })
      .from(services)
      .where(and(eq(services.organizationId, org.id), eq(services.isActive, true)))
      .orderBy(asc(services.sortOrder)),
  ]);

  const rows = await db
    .select({
      id: appointments.id,
      professionalId: appointments.professionalId,
      startAt: appointments.startAt,
      endAt: appointments.endAt,
      status: appointments.status,
      clientName: clients.name,
    })
    .from(appointments)
    .leftJoin(clients, eq(clients.id, appointments.clientId))
    .where(
      and(
        eq(appointments.organizationId, org.id),
        gte(appointments.startAt, dayStartIso),
        lte(appointments.startAt, dayEndIso),
      ),
    );

  // Service names per appointment.
  const serviceByAppt = new Map<string, string[]>();
  if (rows.length > 0) {
    const svcRows = await db
      .select({ appointmentId: appointmentServices.appointmentId, name: appointmentServices.name })
      .from(appointmentServices)
      .where(inArray(appointmentServices.appointmentId, rows.map((r) => r.id)));
    for (const s of svcRows) {
      const list = serviceByAppt.get(s.appointmentId) ?? [];
      list.push(s.name);
      serviceByAppt.set(s.appointmentId, list);
    }
  }

  const appts: AgendaAppointment[] = rows.map((r) => {
    const startMin = (new Date(r.startAt).getTime() - dayRef.getTime()) / 60000;
    const endMin = (new Date(r.endAt).getTime() - dayRef.getTime()) / 60000;
    return {
      id: r.id,
      professionalId: r.professionalId,
      startMin,
      endMin,
      status: r.status,
      startLabel: formatInTimeZone(r.startAt, org.timezone, "HH:mm"),
      endLabel: formatInTimeZone(r.endAt, org.timezone, "HH:mm"),
      clientName: r.clientName,
      services: serviceByAppt.get(r.id) ?? [],
    };
  });

  const prettyDate = formatInTimeZone(dayRef, org.timezone, "EEE dd/MM");

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Agenda</h1>
          <p className="text-muted-foreground">Turnos por profesional.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/dashboard/agenda?date=${addDays(date, -1)}`} className={buttonVariants({ variant: "outline", size: "icon" })}>
            <ChevronLeft className="size-4" />
          </Link>
          <Link href="/dashboard/agenda" className={buttonVariants({ variant: "secondary", size: "sm" })}>
            Hoy
          </Link>
          <span className="min-w-24 text-center text-sm font-medium capitalize">{prettyDate}</span>
          <Link href={`/dashboard/agenda?date=${addDays(date, 1)}`} className={buttonVariants({ variant: "outline", size: "icon" })}>
            <ChevronRight className="size-4" />
          </Link>
          {pros.length > 0 && svc.length > 0 && (
            <NewAppointmentDialog
              org={{ id: org.id, timezone: org.timezone }}
              professionals={pros}
              services={svc}
              defaultDate={date}
            />
          )}
        </div>
      </header>

      {pros.length === 0 ? (
        <p className="text-muted-foreground">No hay profesionales activos.</p>
      ) : (
        <AgendaBoard professionals={pros} appointments={appts} />
      )}
    </div>
  );
}
