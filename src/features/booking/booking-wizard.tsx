"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Loader2, CalendarCheck, MessageCircle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney, depositCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { createPublicBooking, type BookingResult } from "./actions";

type Org = {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  currency: string;
  locale: string;
};
type Service = {
  id: string;
  name: string;
  price_cents: number;
  duration_min: number;
  deposit_type: "none" | "fixed" | "percentage";
  deposit_value: number;
};
type Professional = { id: string; name: string };
type ProfService = { professional_id: string; service_id: string };
type Slot = { startIso: string; label: string; professionalId: string };

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

export function BookingWizard({
  org,
  services,
  professionals,
  profServices,
}: {
  org: Org;
  services: Service[];
  professionals: Professional[];
  profServices: ProfService[];
}) {
  const [step, setStep] = useState(0);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [proMode, setProMode] = useState<"any" | string>("any");
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Extract<BookingResult, { ok: true }> | null>(null);

  const currency = { currency: org.currency, locale: org.locale };
  const service = services.find((s) => s.id === serviceId) ?? null;

  // Professionals eligible for the chosen service (empty mapping = does all).
  function eligiblePros(sid: string): Professional[] {
    const mapped = profServices.filter((ps) => ps.service_id === sid);
    if (mapped.length === 0) return professionals;
    const ids = new Set(mapped.map((ps) => ps.professional_id));
    return professionals.filter((p) => ids.has(p.id));
  }

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: org.timezone,
  }).format(new Date()); // YYYY-MM-DD in org tz
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));

  async function loadSlots(d: string) {
    if (!serviceId) return;
    setLoadingSlots(true);
    setSlots([]);
    setSlot(null);
    const pros = proMode === "any" ? eligiblePros(serviceId) : professionals.filter((p) => p.id === proMode);

    const merged = new Map<string, Slot>();
    await Promise.all(
      pros.map(async (p) => {
        const res = await fetch("/api/availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: org.id,
            professionalId: p.id,
            serviceIds: [serviceId],
            date: d,
          }),
        });
        if (!res.ok) return;
        const json: { slots: { startIso: string; label: string }[] } = await res.json();
        for (const s of json.slots) {
          if (!merged.has(s.label)) merged.set(s.label, { ...s, professionalId: p.id });
        }
      }),
    );
    setSlots([...merged.values()].sort((a, b) => a.startIso.localeCompare(b.startIso)));
    setLoadingSlots(false);
  }

  async function submit() {
    if (!service || !slot) return;
    setSubmitting(true);
    setError(null);
    const res = await createPublicBooking({
      organizationId: org.id,
      professionalId: slot.professionalId,
      serviceIds: [service.id],
      startIso: slot.startIso,
      client: { name, phone, email },
    });
    setSubmitting(false);
    if (res.ok) {
      setResult(res);
    } else {
      setError(res.error);
      if (res.slotTaken && date) {
        // refresh availability so the taken slot disappears
        loadSlots(date);
        setStep(3);
      }
    }
  }

  // ---- Confirmation screen -------------------------------------------------
  if (result && service && slot) {
    const proName = professionals.find((p) => p.id === slot.professionalId)?.name ?? "";
    const waText = encodeURIComponent(
      `¡Hola! Reservé un turno de ${service.name} el ${partsOf(date!).day} ${partsOf(date!).month} a las ${slot.label}. Código: ${result.bookingCode}`,
    );
    return (
      <div className="animate-fade-in text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Check className="size-8" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-semibold">¡Tu turno está confirmado! 💅</h1>
        <div className="mt-6 space-y-2 rounded-2xl border border-border bg-card p-5 text-left text-sm">
          <Row label="Servicio" value={service.name} />
          <Row label="Profesional" value={proName} />
          <Row label="Fecha" value={`${partsOf(date!).weekday} ${partsOf(date!).day} ${partsOf(date!).month}`} />
          <Row label="Hora" value={slot.label} />
          <Row label="Precio" value={formatMoney(service.price_cents, currency)} />
          <Row label="Código" value={result.bookingCode} />
        </div>
        <div className="mt-6 flex flex-col gap-3">
          <a
            href={`https://wa.me/?text=${waText}`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "gold" })}
          >
            <MessageCircle className="size-4" /> Compartir por WhatsApp
          </a>
          <Link href={`/${org.slug}`} className={buttonVariants({ variant: "outline" })}>
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  // ---- Wizard steps --------------------------------------------------------
  return (
    <div className="animate-fade-in">
      <Stepper step={step} total={6} />

      {step === 0 && (
        <Section title="¿Qué servicio querés?">
          <div className="grid gap-3">
            {services.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setServiceId(s.id);
                  setStep(1);
                }}
                className={cn(
                  "flex items-center justify-between rounded-2xl border p-4 text-left transition-colors",
                  serviceId === s.id ? "border-primary bg-secondary/50" : "border-border bg-card hover:bg-muted",
                )}
              >
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-sm text-muted-foreground">{s.duration_min} min</p>
                </div>
                <span className="font-display font-semibold text-primary">
                  {formatMoney(s.price_cents, currency)}
                </span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {step === 1 && serviceId && (
        <Section title="Elegí profesional">
          <div className="grid gap-3">
            <ChoiceButton active={proMode === "any"} onClick={() => { setProMode("any"); setStep(2); }}>
              Cualquiera
            </ChoiceButton>
            {eligiblePros(serviceId).map((p) => (
              <ChoiceButton
                key={p.id}
                active={proMode === p.id}
                onClick={() => { setProMode(p.id); setStep(2); }}
              >
                {p.name}
              </ChoiceButton>
            ))}
          </div>
          <BackButton onClick={() => setStep(0)} />
        </Section>
      )}

      {step === 2 && (
        <Section title="Elegí el día">
          <div className="grid grid-cols-4 gap-2">
            {days.map((d) => {
              const p = partsOf(d);
              return (
                <button
                  key={d}
                  onClick={() => { setDate(d); loadSlots(d); setStep(3); }}
                  className={cn(
                    "flex flex-col items-center rounded-xl border p-2 text-sm transition-colors",
                    date === d ? "border-primary bg-secondary/50" : "border-border bg-card hover:bg-muted",
                  )}
                >
                  <span className="text-xs text-muted-foreground">{p.weekday}</span>
                  <span className="font-semibold">{p.day}</span>
                  <span className="text-xs text-muted-foreground">{p.month}</span>
                </button>
              );
            })}
          </div>
          <BackButton onClick={() => setStep(1)} />
        </Section>
      )}

      {step === 3 && date && (
        <Section title="Elegí horario">
          {loadingSlots ? (
            <div className="flex justify-center py-8 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : slots.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">
              No hay horarios disponibles ese día. Probá con otra fecha.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {slots.map((s) => (
                <button
                  key={s.label}
                  onClick={() => { setSlot(s); setStep(4); }}
                  className={cn(
                    "rounded-xl border py-3 text-sm font-medium transition-colors",
                    slot?.label === s.label ? "border-primary bg-secondary/50" : "border-border bg-card hover:bg-muted",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
          <BackButton onClick={() => setStep(2)} />
        </Section>
      )}

      {step === 4 && (
        <Section title="Tus datos">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">WhatsApp</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+54 9 11 ..." inputMode="tel" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email (opcional)</Label>
              <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" type="email" />
            </div>
          </div>
          <Button
            className="mt-6 w-full"
            disabled={name.trim().length < 2 || phone.trim().length < 6}
            onClick={() => setStep(5)}
          >
            Continuar
          </Button>
          <BackButton onClick={() => setStep(3)} />
        </Section>
      )}

      {step === 5 && service && slot && date && (
        <Section title="Confirmá tu turno">
          <div className="space-y-2 rounded-2xl border border-border bg-card p-5 text-sm">
            <Row label="Servicio" value={service.name} />
            <Row label="Profesional" value={professionals.find((p) => p.id === slot.professionalId)?.name ?? ""} />
            <Row label="Fecha" value={`${partsOf(date).weekday} ${partsOf(date).day} ${partsOf(date).month}`} />
            <Row label="Hora" value={slot.label} />
            <Row label="Precio" value={formatMoney(service.price_cents, currency)} />
            {depositCents(service) > 0 && (
              <Row label="Seña requerida" value={formatMoney(depositCents(service), currency)} />
            )}
          </div>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          <Button className="mt-6 w-full" size="lg" disabled={submitting} onClick={submit}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <CalendarCheck className="size-4" />}
            Confirmar turno
          </Button>
          <BackButton onClick={() => setStep(4)} />
        </Section>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 className="mb-5 font-display text-2xl font-semibold">{title}</h1>
      {children}
    </div>
  );
}

function ChoiceButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-2xl border p-4 text-left font-medium transition-colors",
        active ? "border-primary bg-secondary/50" : "border-border bg-card hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="mt-6 text-sm text-muted-foreground hover:text-foreground">
      ← Volver
    </button>
  );
}

function Stepper({ step, total }: { step: number; total: number }) {
  return (
    <div className="mb-6 flex gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={cn("h-1.5 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-muted")}
        />
      ))}
    </div>
  );
}
