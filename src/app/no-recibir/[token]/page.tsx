import { eq } from "drizzle-orm";
import { CheckCircle2, XCircle } from "lucide-react";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { verifyUnsubscribeToken } from "@/lib/marketing-token";

export const dynamic = "force-dynamic";

export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const parsed = verifyUnsubscribeToken(token);
  let ok = false;
  if (parsed) {
    await db.update(clients).set({ marketingOptOut: true }).where(eq(clients.id, parsed.clientId));
    ok = true;
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        {ok ? (
          <>
            <CheckCircle2 className="mx-auto size-12 text-primary" />
            <h1 className="mt-4 font-display text-2xl font-semibold">Listo</h1>
            <p className="mt-2 text-muted-foreground">
              No vas a recibir más correos de novedades ni promociones. Los recordatorios de tus
              turnos se siguen enviando.
            </p>
          </>
        ) : (
          <>
            <XCircle className="mx-auto size-12 text-destructive" />
            <h1 className="mt-4 font-display text-2xl font-semibold">Enlace inválido</h1>
            <p className="mt-2 text-muted-foreground">
              Este enlace no es válido o ya expiró. Si querés darte de baja, respondé al último correo
              que recibiste.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
