"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Check, XCircle, CalendarClock, ChevronLeft } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { cancelAppointmentByToken, rescheduleAppointmentByToken } from "./manage-actions";

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}
function partsOf(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { weekday: WEEKDAYS[wd], day: d, month: MONTHS[m - 1] };
}

type Slot = { startIso: string; label: string };
type Current = { clientName: string; proName: string; serviceNames: string[]; dateLabel: string; timeLabel: string };

export function ManageClient({
  token,
  orgId,
  timezone,
  slug,
  professionalId,
  serviceIds,
  advanceDays,
  cancellationWindowHours,
  current,
}: {
  token: string;
  orgId: string;
  timezone: string;
  slug: string;
  professionalId: string;
  serviceIds: string[];
  advanceDays: number;
  cancellationWindowHours: number;
  current: Current;
}) {
  const [mode, setMode] = useState<"view" | "reschedule">("view");
  const [done, setDone] = useState<"cancelled" | "rescheduled" | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
  const days = Array.from({ length: Math.max(1, advanceDays) }, (_, i) => addDays(today, i));

  async function loadSlots(d: string) {
    setLoadingSlots(true);
    setSlots([]);
    const res = await fetch("/api/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: orgId, professionalId, serviceIds, date: d }),
    });
    if (res.ok) {
      const json: { slots: Slot[] } = await res.json();
      setSlots(json.slots);
    }
    setLoadingSlots(false);
  }

  async function cancel() {
    if (!confirm("¿Seguro que querés cancelar tu turno?")) return;
    setBusy(true);
    setError(null);
    const res = await cancelAppointmentByToken(token);
    setBusy(false);
    if (res.ok) setDone("cancelled");
    else setError(res.error);
  }

  async function reschedule(startIso: string) {
    setBusy(true);
    setError(null);
    const res = await rescheduleAppointmentByToken(token, startIso);
    setBusy(false);
    if (res.ok) setDone("rescheduled");
    else {
      setError(res.error);
      if (res.slotTaken && date) loadSlots(date);
    }
  }

  if (done === "cancelled") {
    return (
      <Card>
        <XCircle className="size-8 text-muted-foreground" />
        <p className="font-medium">Tu turno fue cancelado.</p>
        <Link href={`/${slug}/reservar`} className={buttonVariants({ className: "mt-2" })}>Reservar otro</Link>
      </Card>
    );
  }
  if (done === "rescheduled") {
    return (
      <Card>
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary"><Check className="size-6" /></div>
        <p className="font-medium">¡Listo! Tu turno fue reprogramado.</p>
        <Link href={`/${slug}`} className={buttonVariants({ variant: "outline", className: "mt-2" })}>Volver</Link>
      </Card>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="space-y-1 rounded-2xl border border-border bg-card p-5 text-sm">
        <Row label="Servicio" value={current.serviceNames.join(", ")} />
        <Row label="Profesional" value={current.proName} />
        <Row label="Fecha" value={current.dateLabel} />
        <Row label="Hora" value={current.timeLabel} />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {mode === "view" ? (
        <div className="flex flex-col gap-3">
          <Button onClick={() => setMode("reschedule")} variant="gold">
            <CalendarClock className="size-4" /> Reprogramar
          </Button>
          <Button onClick={cancel} variant="outline" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />} Cancelar turno
          </Button>
          {cancellationWindowHours > 0 && (
            <p className="text-center text-xs text-muted-foreground">
              Cancelación sin cargo hasta {cancellationWindowHours} h antes del turno.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <button onClick={() => { setMode("view"); setDate(null); }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-4" /> Volver
          </button>
          <div>
            <p className="mb-2 text-sm font-medium">Elegí el nuevo día</p>
            <div className="grid grid-cols-4 gap-2">
              {days.map((d) => {
                const p = partsOf(d);
                return (
                  <button key={d} onClick={() => { setDate(d); loadSlots(d); }} className={cn("flex flex-col items-center rounded-xl border p-2 text-sm transition-colors", date === d ? "border-primary bg-secondary/50" : "border-border bg-card hover:bg-muted")}>
                    <span className="text-xs text-muted-foreground">{p.weekday}</span>
                    <span className="font-semibold">{p.day}</span>
                    <span className="text-xs text-muted-foreground">{p.month}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {date && (
            <div>
              <p className="mb-2 text-sm font-medium">Elegí el horario</p>
              {loadingSlots ? (
                <div className="flex justify-center py-6 text-muted-foreground"><Loader2 className="size-5 animate-spin" /></div>
              ) : slots.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">No hay horarios ese día. Probá otra fecha.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {slots.map((s) => (
                    <button key={s.startIso} disabled={busy} onClick={() => reschedule(s.startIso)} className="rounded-xl border border-border py-3 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50">
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium capitalize">{value}</span>
    </div>
  );
}
function Card({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-8 text-center">{children}</div>;
}
