import Link from "next/link";
import { notFound } from "next/navigation";
import { Instagram, MapPin, Clock, Sparkles } from "lucide-react";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { organizations, services, professionals, businessHours } from "@/db/schema";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default async function PublicOrgPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
  if (!org) notFound();

  const [svc, pros, hours] = await Promise.all([
    db
      .select()
      .from(services)
      .where(and(eq(services.organizationId, org.id), eq(services.isActive, true)))
      .orderBy(asc(services.sortOrder)),
    db
      .select()
      .from(professionals)
      .where(and(eq(professionals.organizationId, org.id), eq(professionals.isActive, true)))
      .orderBy(asc(professionals.sortOrder)),
    db
      .select({
        weekday: businessHours.weekday,
        startTime: businessHours.startTime,
        endTime: businessHours.endTime,
      })
      .from(businessHours)
      .where(and(eq(businessHours.organizationId, org.id), isNull(businessHours.professionalId)))
      .orderBy(asc(businessHours.weekday)),
  ]);

  const currency = { currency: org.currency, locale: org.locale };

  return (
    <main className="min-h-screen pb-28">
      <section className="bg-secondary/40">
        <div className="container flex flex-col items-center py-16 text-center">
          <Badge variant="gold" className="mb-4">
            <Sparkles className="mr-1 size-3" /> Reservá tu turno online
          </Badge>
          <h1 className="font-display text-4xl font-semibold md:text-5xl">{org.name}</h1>
          {org.description && (
            <p className="mt-4 max-w-xl text-muted-foreground">{org.description}</p>
          )}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
            {org.address && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-4" /> {org.address}
              </span>
            )}
            {org.instagram && (
              <span className="inline-flex items-center gap-1">
                <Instagram className="size-4" /> {org.instagram}
              </span>
            )}
          </div>
          <Link href={`/${slug}/reservar`} className={buttonVariants({ size: "lg", className: "mt-8" })}>
            Reservar turno
          </Link>
        </div>
      </section>

      <section className="container py-12">
        <h2 className="mb-6 font-display text-2xl font-semibold">Servicios</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {svc.map((s) => (
            <div
              key={s.id}
              className="flex items-start justify-between rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <div>
                <h3 className="font-medium">{s.name}</h3>
                {s.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
                )}
                <p className="mt-2 text-sm text-muted-foreground">{s.durationMin} min</p>
              </div>
              <span className="shrink-0 font-display text-lg font-semibold text-primary">
                {formatMoney(s.priceCents, currency)}
              </span>
            </div>
          ))}
          {svc.length === 0 && (
            <p className="text-muted-foreground">Todavía no hay servicios cargados.</p>
          )}
        </div>
      </section>

      {pros.length > 0 && (
        <section className="container py-12">
          <h2 className="mb-6 font-display text-2xl font-semibold">Profesionales</h2>
          <div className="flex flex-wrap gap-6">
            {pros.map((p) => (
              <div key={p.id} className="flex flex-col items-center text-center">
                <div className="flex size-20 items-center justify-center rounded-full bg-secondary font-display text-2xl text-secondary-foreground">
                  {p.name.charAt(0)}
                </div>
                <p className="mt-2 font-medium">{p.name}</p>
                {p.specialties.length > 0 && (
                  <p className="text-xs text-muted-foreground">{p.specialties.join(" · ")}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {hours.length > 0 && (
        <section className="container py-12">
          <h2 className="mb-6 font-display text-2xl font-semibold">Horarios</h2>
          <ul className="space-y-1 text-sm">
            {hours.map((h, i) => (
              <li key={i} className="flex items-center gap-3 text-muted-foreground">
                <Clock className="size-4" />
                <span className="w-10 font-medium text-foreground">{WEEKDAYS[h.weekday]}</span>
                {h.startTime.slice(0, 5)} – {h.endTime.slice(0, 5)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 p-4 backdrop-blur md:hidden">
        <Link href={`/${slug}/reservar`} className={buttonVariants({ className: "w-full" })}>
          Reservar turno
        </Link>
      </div>
    </main>
  );
}
