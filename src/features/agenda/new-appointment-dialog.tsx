"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, X } from "lucide-react";
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
  const [serviceId, setServiceId] = useState("");
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
    setServiceId("");
    setDate(defaultDate);
    setSlots([]);
    setStartIso(null);
    setClientName("");
    setClientPhone("");
    setError(null);
  }

  async function loadSlots(pId: string, sId: string, d: string) {
    if (!pId || !sId || !d) return;
    setLoadingSlots(true);
    setSlots([]);
    setStartIso(null);
    const res = await fetch("/api/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: org.id, professionalId: pId, serviceIds: [sId], date: d }),
    });
    if (res.ok) {
      const json: { slots: Slot[] } = await res.json();
      setSlots(json.slots);
    }
    setLoadingSlots(false);
  }

  async function submit() {
    if (!professionalId || !serviceId || !startIso) return;
    setSubmitting(true);
    setError(null);
    const res = await createManualAppointment({
      professionalId,
      serviceIds: [serviceId],
      startIso,
      clientName,
      clientPhone,
    });
    setSubmitting(false);
    if (res.ok) {
      setOpen(false);
      reset();
      router.refresh();
    } else {
      setError(res.error);
      if (res.slotTaken) loadSlots(professionalId, serviceId, date);
    }
  }

  const canSubmit = professionalId && serviceId && startIso && clientName.trim().length >= 2 && clientPhone.trim().length >= 6;

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
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-4">
              <Field label="Profesional">
                <Select
                  value={professionalId}
                  onChange={(v) => {
                    setProfessionalId(v);
                    loadSlots(v, serviceId, date);
                  }}
                  placeholder="Elegí profesional"
                  options={professionals.map((p) => ({ value: p.id, label: p.name }))}
                />
              </Field>

              <Field label="Servicio">
                <Select
                  value={serviceId}
                  onChange={(v) => {
                    setServiceId(v);
                    loadSlots(professionalId, v, date);
                  }}
                  placeholder="Elegí servicio"
                  options={services.map((s) => ({ value: s.id, label: `${s.name} · ${s.durationMin}min` }))}
                />
              </Field>

              <Field label="Fecha">
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    loadSlots(professionalId, serviceId, e.target.value);
                  }}
                />
              </Field>

              {professionalId && serviceId && (
                <Field label="Horario">
                  {loadingSlots ? (
                    <div className="flex justify-center py-3 text-muted-foreground">
                      <Loader2 className="size-5 animate-spin" />
                    </div>
                  ) : slots.length === 0 ? (
                    <p className="py-2 text-sm text-muted-foreground">No hay horarios libres ese día.</p>
                  ) : (
                    <div className="grid grid-cols-4 gap-2">
                      {slots.map((s) => (
                        <button
                          key={s.startIso}
                          onClick={() => setStartIso(s.startIso)}
                          className={cn(
                            "rounded-lg border py-2 text-sm transition-colors",
                            startIso === s.startIso
                              ? "border-primary bg-secondary/60"
                              : "border-border hover:bg-muted",
                          )}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                </Field>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Nombre">
                  <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Clienta" />
                </Field>
                <Field label="WhatsApp">
                  <Input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} inputMode="tel" placeholder="+54 9 11..." />
                </Field>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-11 w-full rounded-xl border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
