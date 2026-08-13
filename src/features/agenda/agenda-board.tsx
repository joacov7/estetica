"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, UserX, CalendarCheck, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppointmentStatus } from "@/db/schema";
import { updateAppointmentStatus } from "./actions";

export type AgendaAppointment = {
  id: string;
  professionalId: string;
  startMin: number;
  endMin: number;
  status: AppointmentStatus;
  startLabel: string;
  endLabel: string;
  clientName: string | null;
  services: string[];
};

type Professional = { id: string; name: string };

const DAY_START = 8; // 08:00
const DAY_END = 21; // 21:00
const HOUR_PX = 64;

// Colors differentiate STATES, not professionals (per spec).
const STATUS_STYLE: Record<AppointmentStatus, string> = {
  reservado: "bg-secondary border-primary/40 text-secondary-foreground",
  confirmado: "bg-primary/15 border-primary text-foreground",
  atendido: "bg-muted border-border text-muted-foreground",
  cancelado: "bg-muted/60 border-border text-muted-foreground line-through opacity-70",
  no_show: "bg-destructive/10 border-destructive/50 text-destructive",
};

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  reservado: "Reservado",
  confirmado: "Confirmado",
  atendido: "Atendido",
  cancelado: "Cancelado",
  no_show: "No vino",
};

export function AgendaBoard({
  professionals,
  appointments,
}: {
  professionals: Professional[];
  appointments: AgendaAppointment[];
}) {
  const hours = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);
  const gridHeight = (DAY_END - DAY_START) * HOUR_PX;

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <div className="flex min-w-max">
        {/* Hour gutter */}
        <div className="w-14 shrink-0 border-r border-border">
          <div className="h-10" />
          <div className="relative" style={{ height: gridHeight }}>
            {hours.map((h, i) => (
              <div
                key={h}
                className="absolute right-2 -translate-y-1/2 text-xs text-muted-foreground"
                style={{ top: i * HOUR_PX }}
              >
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>
        </div>

        {/* Professional columns */}
        {professionals.map((pro) => (
          <div key={pro.id} className="w-56 shrink-0 border-r border-border last:border-r-0">
            <div className="flex h-10 items-center justify-center border-b border-border font-medium">
              {pro.name}
            </div>
            <div className="relative" style={{ height: gridHeight }}>
              {/* hour lines */}
              {hours.map((h, i) => (
                <div
                  key={h}
                  className="absolute inset-x-0 border-t border-border/60"
                  style={{ top: i * HOUR_PX }}
                />
              ))}
              {/* appointments */}
              {appointments
                .filter((a) => a.professionalId === pro.id)
                .map((a) => (
                  <AppointmentCard key={a.id} appt={a} />
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AppointmentCard({ appt }: { appt: AgendaAppointment }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const top = ((appt.startMin - DAY_START * 60) / 60) * HOUR_PX;
  const height = Math.max(((appt.endMin - appt.startMin) / 60) * HOUR_PX, 28);

  function change(status: AppointmentStatus) {
    start(async () => {
      await updateAppointmentStatus(appt.id, status);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="absolute inset-x-1" style={{ top, height }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "h-full w-full overflow-hidden rounded-lg border p-1.5 text-left text-xs transition-shadow hover:shadow-md",
          STATUS_STYLE[appt.status],
        )}
      >
        <div className="font-medium">
          {appt.startLabel} · {appt.clientName ?? "Sin nombre"}
        </div>
        <div className="truncate opacity-80">{appt.services.join(", ")}</div>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-10 mt-1 w-44 rounded-xl border border-border bg-popover p-1 shadow-lg">
          <p className="px-2 py-1 text-[11px] text-muted-foreground">
            {STATUS_LABEL[appt.status]}
          </p>
          <MenuItem icon={Check} label="Confirmar" onClick={() => change("confirmado")} disabled={pending} />
          <MenuItem icon={CalendarCheck} label="Marcar atendido" onClick={() => change("atendido")} disabled={pending} />
          <MenuItem icon={UserX} label="No vino" onClick={() => change("no_show")} disabled={pending} />
          <MenuItem icon={X} label="Cancelar turno" onClick={() => change("cancelado")} disabled={pending} destructive />
          {pending && (
            <div className="flex justify-center py-1">
              <Loader2 className="size-3 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  disabled,
  destructive,
}: {
  icon: typeof Check;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-muted disabled:opacity-50",
        destructive && "text-destructive",
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}
