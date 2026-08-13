import Link from "next/link";
import { Gift } from "lucide-react";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { clients, appointments } from "@/db/schema";
import { getCurrentOrg } from "@/features/org/current";

export const dynamic = "force-dynamic";

export default async function ReferidosPage() {
  const { org } = await getCurrentOrg();
  if (!org) return <p className="text-muted-foreground">Todavía no tenés un negocio.</p>;

  const [all, attendedRows] = await Promise.all([
    db.select({ id: clients.id, name: clients.name, referredById: clients.referredById }).from(clients).where(eq(clients.organizationId, org.id)),
    db.selectDistinct({ clientId: appointments.clientId }).from(appointments).where(and(eq(appointments.organizationId, org.id), eq(appointments.status, "atendido"))),
  ]);

  const nameById = new Map(all.map((c) => [c.id, c.name]));
  const attended = new Set(attendedRows.map((r) => r.clientId).filter(Boolean) as string[]);

  // referrer id -> referred clients
  const byReferrer = new Map<string, string[]>();
  for (const c of all) {
    if (c.referredById) {
      const list = byReferrer.get(c.referredById) ?? [];
      list.push(c.id);
      byReferrer.set(c.referredById, list);
    }
  }

  const leaderboard = [...byReferrer.entries()]
    .map(([refId, referredIds]) => ({
      id: refId,
      name: nameById.get(refId) ?? "—",
      total: referredIds.length,
      converted: referredIds.filter((id) => attended.has(id)).length,
    }))
    .sort((a, b) => b.total - a.total);

  const totalReferred = all.filter((c) => c.referredById).length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">Referidos</h1>
        <p className="text-muted-foreground">Quién trae nuevas clientas. El premio lo decidís vos.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Clientas por referido" value={String(totalReferred)} />
        <Stat label="Referidoras activas" value={String(leaderboard.length)} />
        <Stat label="Ya vinieron" value={String(leaderboard.reduce((s, r) => s + r.converted, 0))} />
      </div>

      {leaderboard.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center text-muted-foreground">
          <Gift className="size-6" />
          <p className="max-w-sm">
            Todavía no hay referidos. Cada clienta tiene su link para compartir en su ficha:
            cuando alguien reserva con su código, aparece acá.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-4 font-medium">Referidora</th>
                <th className="p-4 font-medium">Trajo</th>
                <th className="p-4 font-medium">Ya vinieron</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                  <td className="p-4 font-medium">
                    <Link href={`/dashboard/clientes/${r.id}`} className="hover:text-primary hover:underline">{r.name}</Link>
                  </td>
                  <td className="p-4">{r.total}</td>
                  <td className="p-4 text-primary font-medium">{r.converted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <span className="text-sm text-muted-foreground">{label}</span>
      <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}
