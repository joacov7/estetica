import Link from "next/link";
import { ChevronLeft, ChevronRight, Bell, Check } from "lucide-react";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import { appointments, clients, appointmentServices, notifications } from "@/db/schema";
import { getCurrentOrg } from "@/features/org/current";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReminderButton } from "@/features/reminders/reminder-button";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const WD = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

export default async function RecordatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { org } = await getCurrentOrg();
  if (!org) return <p className="text-muted-foreground">Todavía no tenés un negocio.</p>;

  const sp = await searchParams;
  const today = formatInTimeZone(new Date(), org.timezone, "yyyy-MM-dd");
  const tomorrow = addDays(today, 1);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : tomorrow;

  const dayRef = fromZonedTime(`${date}T00:00:00`, org.timezone);
  const dayStart = dayRef.toISOString();
  const dayEnd = new Date(dayRef.getTime() + DAY_MS).toISOString();

  const rows = await db
    .select({
      id: appointments.id,
      startAt: appointments.startAt,
      status: appointments.status,
      clientName: clients.name,
      phone: clients.phone,
    })
    .from(appointments)
    .leftJoin(clients, eq(clients.id, appointments.clientId))
    .where(
      and(
        eq(appointments.organizationId, org.id),
        gte(appointments.startAt, dayStart),
        lt(appointments.startAt, dayEnd),
        inArray(appointments.status, ["reservado", "confirmado"]),
      ),
    )
    .orderBy(asc(appointments.startAt));

  // Services per appointment + which already got a reminder.
  const svcByAppt = new Map<string, string[]>();
  const sentSet = new Set<string>();
  if (rows.length > 0) {
    const ids = rows.map((r) => r.id);
    const [svcRows, notifRows] = await Promise.all([
      db.select({ appointmentId: appointmentServices.appointmentId, name: appointmentServices.name }).from(appointmentServices).where(inArray(appointmentServices.appointmentId, ids)),
      db.select({ appointmentId: notifications.appointmentId }).from(notifications).where(and(inArray(notifications.appointmentId, ids), eq(notifications.type, "reminder_24h"))),
    ]);
    for (const s of svcRows) {
      const l = svcByAppt.get(s.appointmentId) ?? [];
      l.push(s.name);
      svcByAppt.set(s.appointmentId, l);
    }
    for (const n of notifRows) if (n.appointmentId) sentSet.add(n.appointmentId);
  }

  const isTomorrow = date === tomorrow;
  const [y, m, d] = date.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const whenText = isTomorrow ? "mañana" : `el ${WD[wd]} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
  const prettyDate = formatInTimeZone(dayRef, org.timezone, "EEE dd/MM");

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Recordatorios</h1>
          <p className="text-muted-foreground">Avisá por WhatsApp los turnos del día.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/dashboard/recordatorios?date=${addDays(date, -1)}`} className={buttonVariants({ variant: "outline", size: "icon" })}><ChevronLeft className="size-4" /></Link>
          <Link href="/dashboard/recordatorios" className={buttonVariants({ variant: "secondary", size: "sm" })}>Mañana</Link>
          <span className="min-w-24 text-center text-sm font-medium capitalize">{prettyDate}</span>
          <Link href={`/dashboard/recordatorios?date=${addDays(date, 1)}`} className={buttonVariants({ variant: "outline", size: "icon" })}><ChevronRight className="size-4" /></Link>
        </div>
      </header>

      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {rows.map((r) => {
          const hora = formatInTimeZone(r.startAt, org.timezone, "HH:mm");
          const svcs = svcByAppt.get(r.id) ?? [];
          const sent = sentSet.has(r.id);
          const firstName = (r.clientName ?? "").split(" ")[0] || "";
          const message = `Hola ${firstName} 💕 Te recordamos que ${whenText} a las ${hora} tenés tu turno de ${svcs.join(" + ") || "belleza"} en ${org.name}. ¿Confirmás? 💅`;
          return (
            <div key={r.id} className="flex items-center justify-between gap-4 p-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{hora}</span>
                  <span className="text-muted-foreground">·</span>
                  <span>{r.clientName ?? "Sin nombre"}</span>
                  {sent && <Badge variant="muted"><Check className="mr-1 size-3" /> Enviado</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">{svcs.join(", ")}</p>
              </div>
              {r.phone ? (
                <ReminderButton appointmentId={r.id} phone={r.phone} message={message} sent={sent} />
              ) : (
                <span className="text-sm text-muted-foreground">Sin teléfono</span>
              )}
            </div>
          );
        })}
        {rows.length === 0 && (
          <div className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
            <Bell className="size-6" />
            <p>No hay turnos para recordar ese día.</p>
          </div>
        )}
      </div>
    </div>
  );
}
