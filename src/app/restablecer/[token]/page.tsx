"use client";

import { useState, use } from "react";
import Link from "next/link";
import { Loader2, Check } from "lucide-react";
import { resetPassword } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RestablecerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pass !== pass2) { setError("Las contraseñas no coinciden"); return; }
    setPending(true);
    setError(null);
    const res = await resetPassword(token, pass);
    setPending(false);
    if (res.ok) setDone(true);
    else setError(res.error);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {done ? (
          <div className="text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Check className="size-7" />
            </div>
            <h1 className="mt-4 font-display text-2xl font-semibold">¡Listo!</h1>
            <p className="mt-2 text-muted-foreground">Tu contraseña se cambió. Ya podés iniciar sesión.</p>
            <Link href="/login" className="mt-6 inline-block rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground">
              Iniciar sesión
            </Link>
          </div>
        ) : (
          <>
            <h1 className="mb-1 font-display text-3xl font-semibold">Nueva contraseña</h1>
            <p className="mb-6 text-muted-foreground">Elegí una contraseña de al menos 8 caracteres.</p>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="p1">Nueva contraseña</Label>
                <Input id="p1" type="password" value={pass} onChange={(e) => setPass(e.target.value)} required minLength={8} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p2">Repetir contraseña</Label>
                <Input id="p2" type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} required minLength={8} />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={pending}>
                {pending && <Loader2 className="size-4 animate-spin" />} Cambiar contraseña
              </Button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
