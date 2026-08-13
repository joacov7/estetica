import Link from "next/link";
import { Sparkles, CalendarCheck, Users, ShieldCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <section className="container flex flex-col items-center py-24 text-center">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-1.5 text-sm text-secondary-foreground">
          <Sparkles className="size-4" /> Turnos online para tu estudio
        </span>
        <h1 className="max-w-3xl text-balance font-display text-5xl font-semibold leading-tight md:text-6xl">
          La forma simple de gestionar los turnos de tu estudio de belleza
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Reservas online, agenda por profesional, clientes y disponibilidad en
          tiempo real. Pensado para manicura, pestañas, cejas y estética.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link href="/dashboard" className={buttonVariants({ size: "lg" })}>
            Ir al panel
          </Link>
          <Link
            href="/buenas-unas"
            className={buttonVariants({ size: "lg", variant: "outline" })}
          >
            Ver estudio de ejemplo
          </Link>
        </div>
      </section>

      <section className="container grid gap-6 pb-24 md:grid-cols-3">
        {[
          {
            icon: CalendarCheck,
            title: "Reservá en 60 segundos",
            body: "Tus clientas reservan desde el celular, sin instalar nada ni registrarse.",
          },
          {
            icon: Users,
            title: "Agenda por profesional",
            body: "Vista diaria por columnas, estados de turno y bloqueos de horario.",
          },
          {
            icon: ShieldCheck,
            title: "Sin dobles reservas",
            body: "La disponibilidad se calcula en el servidor y la base de datos garantiza que no haya solapamientos.",
          },
        ].map((f) => (
          <div key={f.title} className="rounded-2xl border border-border bg-card p-8 shadow-sm">
            <f.icon className="size-8 text-primary" />
            <h3 className="mt-4 font-display text-xl font-semibold">{f.title}</h3>
            <p className="mt-2 text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
