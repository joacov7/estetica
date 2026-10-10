import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { loyaltyTransactions, appointmentServices, appointments } from "@/db/schema";
import { getOrgSettings, type OrgSettings } from "@/lib/settings";

/** Points earned for a net amount spent (0 if loyalty is off or rate invalid). */
export function pointsForAmount(netCents: number, s: OrgSettings): number {
  if (!s.loyaltyEnabled || s.loyaltyEarnPerCents <= 0 || netCents <= 0) return 0;
  return Math.floor(netCents / s.loyaltyEarnPerCents);
}

/** Current points balance for a client (sum of the ledger). */
export async function getPointsBalance(orgId: string, clientId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${loyaltyTransactions.points}), 0)` })
    .from(loyaltyTransactions)
    .where(and(eq(loyaltyTransactions.organizationId, orgId), eq(loyaltyTransactions.clientId, clientId)));
  return Number(row?.total ?? 0);
}

/**
 * Award points for an attended appointment. Idempotent: the unique
 * (appointment_id, kind) index means a second attempt is silently ignored, so
 * re-marking "atendido" never double-credits. Safe to call outside a tx.
 */
export async function awardPointsForAppointment(
  orgId: string,
  appointmentId: string,
): Promise<void> {
  const settings = await getOrgSettings(orgId);
  if (!settings.loyaltyEnabled || settings.loyaltyEarnPerCents <= 0) return;

  const [appt] = await db
    .select({ clientId: appointments.clientId, discountCents: appointments.discountCents })
    .from(appointments)
    .where(and(eq(appointments.id, appointmentId), eq(appointments.organizationId, orgId)))
    .limit(1);
  if (!appt || !appt.clientId) return;

  const [agg] = await db
    .select({ total: sql<number>`coalesce(sum(${appointmentServices.priceCents}), 0)` })
    .from(appointmentServices)
    .where(eq(appointmentServices.appointmentId, appointmentId));
  const net = Math.max(0, Number(agg?.total ?? 0) - (appt.discountCents ?? 0));
  const points = pointsForAmount(net, settings);
  if (points <= 0) return;

  try {
    await db.insert(loyaltyTransactions).values({
      organizationId: orgId,
      clientId: appt.clientId,
      points,
      kind: "earn",
      reason: "Turno atendido",
      appointmentId,
    });
  } catch (e) {
    // Unique violation (23505) = points already awarded for this appointment.
    const code = (e as { code?: string; cause?: { code?: string } })?.code ??
      (e as { cause?: { code?: string } })?.cause?.code;
    if (code !== "23505") throw e;
  }
}
