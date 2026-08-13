"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addClientNote } from "./actions";

/** Add-note box for the client detail page. */
export function NoteForm({ clientId }: { clientId: string }) {
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await addClientNote(clientId, body);
    setSaving(false);
    if (res.ok) setBody("");
    else setError(res.error);
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Ej: Le gusta forma almendrada. Prefiere tonos nude."
        rows={2}
        className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="sm" disabled={saving || body.trim().length === 0}>
        {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Agregar nota
      </Button>
    </form>
  );
}
