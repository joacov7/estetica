"use client";

import { useState } from "react";
import { Pencil, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfessional } from "./actions";

export function EditProfessionalDialog({
  professional,
}: {
  professional: { id: string; name: string; specialties: string[] };
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(professional.name);
  const [specialties, setSpecialties] = useState(professional.specialties.join(", "));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await updateProfessional(professional.id, { name, specialties, isActive: true });
    setSaving(false);
    if (res.ok) setOpen(false);
    else setError(res.error);
  }

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Editar" className="text-muted-foreground hover:text-foreground">
        <Pencil className="size-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <form onSubmit={save} className="w-full max-w-md rounded-t-2xl bg-card p-6 shadow-xl sm:rounded-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">Editar profesional</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nombre</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Especialidades</Label>
                <Input value={specialties} onChange={(e) => setSpecialties(e.target.value)} placeholder="Soft Gel, Nail Art" />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="size-4 animate-spin" />} Guardar
                </Button>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
