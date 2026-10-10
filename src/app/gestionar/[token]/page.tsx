import Link from "next/link";
import { XCircle, CalendarClock } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { appointments, appointmentServices, organizations, professionals, clients } from "@/db/schema";
import { verifyBookingToken } from "@/lib/booking-token";
import { getOrgSettings } from "@/lib/settings";
import { getPointsBalance } from "@/features/loyalty/points";
import { formatMoney } from "@/lib/money";
import { Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ManageClient } from "@/features/booking/manage-client";

export const dynamic = "force-dynamic";

export default async function ManagePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const payload = verifyBookingToken(token);
  if (!payload) return <Invalid />;

  const [appt] = await db
    .select()
    .from(appointments)
    .where(and(eq(appointments.id, payload.appointmentId), eq(appointments.bookingCode, payload.bookingCode)))
    .limit(1);
  if (!appt) return <Invalid />;

  const [org] = await db
    .select({ id: organizations.id, slug: organizations.slug, name: organizations.name, timezone: organizations.timezone, currency: organizations.currency, locale: organizations.locale })
    .from(organizations)
    .where(eq(organizations.id, appt.organizationId))
    .limit(1);
  if (!org) return <Invalid />;

  const [[pro], svcRows, [client], settings] = await Promise.all([
    db.select({ name: professionals.name }).from(professionals).where(eq(professionals.id, appt.professionalId)).limit(1),
    db.select({ name: appointmentServices.name, serviceId: appointmentServices.serviceId }).from(appointmentServices).where(eq(appointmentServices.appointmentId, appt.id)),
    appt.clientId ? db.select({ name: clients.name }).from(clients).where(eq(clients.id, appt.clientId)).limit(1) : Promise.resolve([{ name: "" }]),
    getOrgSettings(appt.organizationId),
  ]);

  const points = settings.loyaltyEnabled && appt.clientId ? await getPointsBalance(org.id, appt.clientId) : 0;

  const serviceIds = svcRows.filter((s) => s.serviceId).map((s) => s.serviceId!) as string[];
  const serviceNames = svcRows.map((s) => s.name);
  const dateLabel = formatInTimeZone(appt.startAt, org.timezone, "EEEE dd/MM");
  const timeLabel = formatInTimeZone(appt.startAt, org.timezone, "HH:mm");

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-8">
      <Link href={`/${org.slug}`} className="text-sm text-muted-foreground hover:text-foreground">
        {org.name}
      </Link>
      <h1 className="mt-2 font-display text-2xl font-semibold">Tu turno</h1>

      {points > 0 && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-border bg-secondary/40 p-3 text-sm">
          <Sparkles className="size-4 text-primary" />
          <span>
            Tenés <strong>{points} puntos</strong> acumulados
            {settings.loyaltyPointValueCents > 0 && (
              <> · equivalen a {formatMoney(points * settings.loyaltyPointValueCents, { currency: org.currency, locale: org.locale })} de descuento</>
            )}
          </span>
        </div>
      )}

      {appt.status === "cancelado" ? (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-8 text-center">
          <XCircle className="size-8 text-muted-foreground" />
          <p className="font-medium">Este turno está cancelado.</p>
          <Link href={`/${org.slug}/reservar`} className={buttonVariants({ className: "mt-2" })}>Reservar de nuevo</Link>
        </div>
      ) : appt.status === "atendido" ? (
        <div className="mt-6 rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
          Este turno ya fue atendido. ¡Gracias! 💅
        </div>
      ) : (
        <ManageClient
          token={token}
          orgId={org.id}
          timezone={org.timezone}
          slug={org.slug}
          professionalId={appt.professionalId}
          serviceIds={serviceIds}
          advanceDays={settings.advanceDays}
          cancellationWindowHours={settings.cancellationWindowHours}
          current={{
            clientName: client?.name ?? "",
            proName: pro?.name ?? "",
            serviceNames,
            dateLabel,
            timeLabel,
          }}
        />
      )}
    </main>
  );
}

function Invalid() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-3 px-4 text-center">
      <CalendarClock className="size-8 text-muted-foreground" />
      <h1 className="font-display text-2xl font-semibold">Enlace inválido o vencido</h1>
      <p className="text-muted-foreground">No pudimos encontrar este turno.</p>
    </main>
  );
}
