"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, MailCheck } from "lucide-react";
import { requestPasswordReset } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function OlvidePage() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [emailOff, setEmailOff] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const res = await requestPasswordReset(email);
    setPending(false);
    setEmailOff(!res.emailConfigured);
    setDone(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {done ? (
          <div className="text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-secondary text-primary">
              <MailCheck className="size-7" />
            </div>
            <h1 className="mt-4 font-display text-2xl font-semibold">Revisá tu email</h1>
            <p className="mt-2 text-muted-foreground">
              Si ese email tiene una cuenta, te enviamos un enlace para elegir una nueva contraseña. Vence en 1 hora.
            </p>
            {emailOff && (
              <p className="mt-3 rounded-xl border border-gold/40 bg-gold/10 p-3 text-sm text-gold-foreground">
                Nota: el envío de emails todavía no está configurado (falta Resend), así que el enlace no llegará hasta activarlo.
              </p>
            )}
            <Link href="/login" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">
              Volver a iniciar sesión
            </Link>
          </div>
        ) : (
          <>
            <h1 className="mb-1 font-display text-3xl font-semibold">¿Olvidaste tu contraseña?</h1>
            <p className="mb-6 text-muted-foreground">Te enviamos un enlace para restablecerla.</p>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="tu@email.com" />
              </div>
              <Button type="submit" className="w-full" disabled={pending}>
                {pending && <Loader2 className="size-4 animate-spin" />} Enviar enlace
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              <Link href="/login" className="font-medium text-primary hover:underline">Volver</Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
