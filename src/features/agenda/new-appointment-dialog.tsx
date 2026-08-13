"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createManualAppointment } from "./actions";

type Org = { id: string; timezone: string };
type Professional = { id: string; name: string };
type Service = { id: string; name: string; durationMin: number };
type Slot = { startIso: string; label: string };

export function NewAppointmentDialog({
  org,
  professionals,
  services,
  defaultDate,
}: {
  org: Org;
  professionals: Professional[];
  services: Service[];
  defaultDate: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [professionalId, setProfessionalId] = useState("");
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [date, setDate] = useState(defaultDate);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [startIso, setStartIso] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setProfessionalId("");
    setServiceIds([]);
    setDate(defaultDate);
    setSlots([]);
    setStartIso(null);
    setClientName("");
    setClientPhone("");
    setError(null);
  }

  async function loadSlots(pId: string, sIds: string[], d: string) {
    if (!pId || sIds.length === 0 || !d) {
      setSlots([]);
      setStartIso(null);
      return;
    }
    setLoadingSlots(true);
    setSlots([]);
    setStartIso(null);
    const res = await fetch("/api/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: org.id, professionalId: pId, serviceIds: sIds, date: d }),
    });
    if (res.ok) {
      const json: { slots: Slot[] } = await res.json();
      setSlots(json.slots);
    }
    setLoadingSlots(false);
  }

  function toggleService(id: string) {
    const next = serviceIds.includes(id) ? serviceIds.filter((x) => x !== id) : [...serviceIds, id];
    setServiceIds(next);
    loadSlots(professionalId, next, date);
  }

  async function submit() {
    if (!professionalId || serviceIds.length === 0 || !startIso) return;
    setSubmitting(true);
    setError(null);
    const res = await createManualAppointment({ professionalId, serviceIds, startIso, clientName, clientPhone });
    setSubmitting(false);
    if (res.ok) {
      setOpen(false);
      reset();
      router.refresh();
    } else {
      setError(res.error);
      if (res.slotTaken) loadSlots(professionalId, serviceIds, date);
    }
  }

  const canSubmit = professionalId && serviceIds.length > 0 && startIso && clientName.trim().length >= 2 && clientPhone.trim().length >= 6;

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Nuevo turno
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-card p-6 shadow-xl sm:rounded-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">Nuevo turno</h2>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="size-5" /></button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Profesional</Label>
                <select
                  value={professionalId}
                  onChange={(e) => { setProfessionalId(e.target.value); loadSlots(e.target.value, serviceIds, date); }}
                  className="flex h-11 w-full rounded-xl border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="" disabled>Elegí profesional</option>
                  {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label>Servicios</Label>
                <div className="space-y-2">
                  {services.map((s) => {
                    const on = serviceIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleService(s.id)}
                        className={cn("flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm transition-colors", on ? "border-primary bg-secondary/50" : "border-border hover:bg-muted")}
                      >
                        <span className={cn("flex size-5 items-center justify-center rounded-full border", on ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                          {on && <Check className="size-3.5" />}
                        </span>
                        <span className="flex-1 font-medium">{s.name}</span>
                        <span className="text-muted-foreground">{s.durationMin}min</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Fecha</Label>
                <Input type="date" value={date} onChange={(e) => { setDate(e.target.value); loadSlots(professionalId, serviceIds, e.target.value); }} />
              </div>

              {professionalId && serviceIds.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Horario</Label>
                  {loadingSlots ? (
                    <div className="flex justify-center py-3 text-muted-foreground"><Loader2 className="size-5 animate-spin" /></div>
                  ) : slots.length === 0 ? (
                    <p className="py-2 text-sm text-muted-foreground">No hay horarios libres ese día.</p>
                  ) : (
                    <div className="grid grid-cols-4 gap-2">
                      {slots.map((s) => (
                        <button key={s.startIso} onClick={() => setStartIso(s.startIso)} className={cn("rounded-lg border py-2 text-sm transition-colors", startIso === s.startIso ? "border-primary bg-secondary/60" : "border-border hover:bg-muted")}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Nombre</Label><Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Clienta" /></div>
                <div className="space-y-1.5"><Label>WhatsApp</Label><Input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} inputMode="tel" placeholder="+54 9 11..." /></div>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button className="w-full" disabled={!canSubmit || submitting} onClick={submit}>
                {submitting && <Loader2 className="size-4 animate-spin" />} Crear turno
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
