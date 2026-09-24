import Link from "next/link";
import { notFound } from "next/navigation";
import { Instagram, MapPin, Clock, Sparkles, MessageCircle, ChevronRight, Navigation, Star } from "lucide-react";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { organizations, services, professionals, businessHours, reviews } from "@/db/schema";
import { buttonVariants } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { getOrgSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const WD_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default async function PublicOrgPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
  if (!org) notFound();

  const [svc, pros, hours, settings, revList] = await Promise.all([
    db.select().from(services).where(and(eq(services.organizationId, org.id), eq(services.isActive, true))).orderBy(asc(services.sortOrder)),
    db.select().from(professionals).where(and(eq(professionals.organizationId, org.id), eq(professionals.isActive, true))).orderBy(asc(professionals.sortOrder)),
    db
      .select({ weekday: businessHours.weekday, startTime: businessHours.startTime, endTime: businessHours.endTime })
      .from(businessHours)
      .where(and(eq(businessHours.organizationId, org.id), isNull(businessHours.professionalId)))
      .orderBy(asc(businessHours.weekday)),
    getOrgSettings(org.id),
    db
      .select({ id: reviews.id, authorName: reviews.authorName, rating: reviews.rating, comment: reviews.comment })
      .from(reviews)
      .where(and(eq(reviews.organizationId, org.id), eq(reviews.status, "published")))
      .orderBy(desc(reviews.isFeatured), desc(reviews.createdAt))
      .limit(6),
  ]);
  const reviewCount = revList.length;
  const reviewAvg = reviewCount ? revList.reduce((s, r) => s + r.rating, 0) / reviewCount : 0;

  const currency = { currency: org.currency, locale: org.locale };
  const initial = org.name.trim().charAt(0).toUpperCase();
  const openDays = [...new Set(hours.map((h) => h.weekday))].sort();
  const openLabel =
    openDays.length > 0
      ? `${WD_SHORT[openDays[0]]}–${WD_SHORT[openDays[openDays.length - 1]]}`
      : null;
  const waDigits = (org.whatsapp ?? "").replace(/\D/g, "");
  const mapsUrl = org.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(org.address)}`
    : null;

  return (
    <main className="min-h-screen bg-background pb-28 md:pb-0">
      {/* ---------- HERO ---------- */}
      <section className="relative overflow-hidden">
        {org.coverUrl ? (
          <div className="absolute inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={org.coverUrl} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/25 to-background" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(120%_100%_at_50%_-10%,hsl(var(--secondary))_0%,transparent_60%)]" />
        )}

        <div className="container relative flex flex-col items-center px-6 py-16 text-center md:py-24">
          {/* logo / monogram */}
          {org.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logoUrl} alt={org.name} className="mb-5 size-24 rounded-full object-cover shadow-lg ring-4 ring-background" />
          ) : (
            <div className="mb-5 flex size-24 items-center justify-center rounded-full bg-card font-display text-4xl font-semibold text-primary shadow-lg ring-1 ring-gold/40">
              {initial}
            </div>
          )}

          <h1 className={`font-display text-4xl font-semibold tracking-tight md:text-5xl ${org.coverUrl ? "text-white drop-shadow" : "text-foreground"}`}>
            {org.name}
          </h1>

          {org.description && (
            <p className={`mt-4 max-w-md text-pretty ${org.coverUrl ? "text-white/90" : "text-muted-foreground"}`}>
              {org.description}
            </p>
          )}

          <div className={`mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm ${org.coverUrl ? "text-white/85" : "text-muted-foreground"}`}>
            {org.address && (
              <span className="inline-flex items-center gap-1.5"><MapPin className="size-4" /> {org.address}</span>
            )}
            {openLabel && (
              <span className="inline-flex items-center gap-1.5"><Clock className="size-4" /> {openLabel}</span>
            )}
          </div>

          <Link href={`/${slug}/reservar`} className={buttonVariants({ size: "lg", className: "mt-8 shadow-md" })}>
            <Sparkles className="size-4" /> Reservar turno
          </Link>

          {org.instagram && (
            <a
              href={`https://instagram.com/${org.instagram.replace(/^@/, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`mt-4 inline-flex items-center gap-1.5 text-sm font-medium ${org.coverUrl ? "text-white/90" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Instagram className="size-4" /> {org.instagram}
            </a>
          )}
        </div>
      </section>

      {/* ---------- SERVICIOS ---------- */}
      <section className="container px-6 py-12">
        <SectionTitle kicker="Nuestros servicios" title="Elegí lo que te querés hacer" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {svc.map((s) => (
            <Link
              key={s.id}
              href={`/${slug}/reservar?servicio=${s.id}`}
              className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              {s.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.imageUrl} alt="" className="size-16 shrink-0 rounded-xl object-cover" />
              ) : (
                <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-secondary/60 text-primary">
                  <Sparkles className="size-6" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="font-medium">{s.name}</h3>
                {s.description && <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{s.description}</p>}
                <p className="mt-1 text-sm text-muted-foreground">{s.durationMin} min</p>
              </div>
              <div className="flex shrink-0 flex-col items-end">
                <span className="font-display text-lg font-semibold text-primary">{formatMoney(s.priceCents, currency)}</span>
                <span className="mt-1 inline-flex items-center text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary">
                  Reservar <ChevronRight className="size-3.5" />
                </span>
              </div>
            </Link>
          ))}
          {svc.length === 0 && <p className="text-muted-foreground">Pronto vas a poder reservar online. 💅</p>}
        </div>
      </section>

      {/* ---------- PROFESIONALES ---------- */}
      {pros.length > 0 && (
        <section className="container px-6 py-12">
          <SectionTitle kicker="Quién te atiende" title="Profesionales" />
          <div className="mt-8 flex flex-wrap justify-center gap-8 sm:justify-start">
            {pros.map((p) => (
              <div key={p.id} className="flex w-28 flex-col items-center text-center">
                {p.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photoUrl} alt={p.name} className="size-20 rounded-full object-cover shadow-sm ring-1 ring-border" />
                ) : (
                  <div className="flex size-20 items-center justify-center rounded-full bg-secondary font-display text-2xl text-secondary-foreground">
                    {p.name.charAt(0)}
                  </div>
                )}
                <p className="mt-3 font-medium">{p.name}</p>
                {p.specialties.length > 0 && (
                  <p className="text-xs text-muted-foreground">{p.specialties.join(" · ")}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---------- OPINIONES ---------- */}
      {settings.reviewsEnabled && reviewCount > 0 && (
        <section className="container px-6 py-12">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SectionTitle kicker="Opiniones" title="Lo que dicen nuestras clientas" />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="inline-flex">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} className={`size-4 ${n <= Math.round(reviewAvg) ? "fill-primary text-primary" : "text-muted-foreground/40"}`} />
                ))}
              </span>
              {reviewAvg.toFixed(1)}
            </div>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {revList.map((r) => (
              <figure key={r.id} className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm">
                <span className="inline-flex">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className={`size-4 ${n <= r.rating ? "fill-primary text-primary" : "text-muted-foreground/40"}`} />
                  ))}
                </span>
                {r.comment && <blockquote className="mt-3 flex-1 text-sm text-foreground/90">“{r.comment}”</blockquote>}
                <figcaption className="mt-3 text-sm font-medium text-muted-foreground">— {r.authorName}</figcaption>
              </figure>
            ))}
          </div>
          <div className="mt-6 text-center sm:text-left">
            <Link href={`/${slug}/opiniones`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Ver todas y dejar la tuya <ChevronRight className="size-4" />
            </Link>
          </div>
        </section>
      )}

      {/* ---------- INFO ---------- */}
      <section className="container px-6 py-12">
        <SectionTitle kicker="Información" title="Cómo llegar y horarios" />
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {/* Horarios */}
          {hours.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold"><Clock className="size-5 text-primary" /> Horarios</h3>
              <ul className="space-y-1.5 text-sm">
                {hours.map((h, i) => (
                  <li key={i} className="flex items-center justify-between text-muted-foreground">
                    <span className="font-medium text-foreground">{WEEKDAYS[h.weekday]}</span>
                    <span>{h.startTime.slice(0, 5)} – {h.endTime.slice(0, 5)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Contacto */}
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h3 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold"><MapPin className="size-5 text-primary" /> Contacto</h3>
            {org.address && <p className="text-sm text-muted-foreground">{org.address}</p>}
            <div className="mt-1 flex flex-wrap gap-2">
              {mapsUrl && (
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  <Navigation className="size-4" /> Cómo llegar
                </a>
              )}
              {waDigits && (
                <a href={`https://wa.me/${waDigits}`} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  <MessageCircle className="size-4" /> WhatsApp
                </a>
              )}
              {org.instagram && (
                <a href={`https://instagram.com/${org.instagram.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  <Instagram className="size-4" /> Instagram
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        {org.name}{org.address ? ` · ${org.address}` : ""}
      </footer>

      {/* ---------- CTA fijo mobile ---------- */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-4 backdrop-blur md:hidden">
        <Link href={`/${slug}/reservar`} className={buttonVariants({ size: "lg", className: "w-full" })}>
          <Sparkles className="size-4" /> Reservar turno
        </Link>
      </div>
    </main>
  );
}

function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="text-center sm:text-left">
      <span className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-primary">{kicker}</span>
      <h2 className="mt-1 font-display text-2xl font-semibold md:text-3xl">{title}</h2>
    </div>
  );
}
