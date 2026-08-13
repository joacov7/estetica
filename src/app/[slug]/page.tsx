import Link from "next/link";
import { notFound } from "next/navigation";
import { Instagram, MapPin, Clock, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
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
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!org) notFound();

  const [{ data: services }, { data: professionals }, { data: hours }] =
    await Promise.all([
      supabase
        .from("services")
        .select("*")
        .eq("organization_id", org.id)
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("professionals")
        .select("*")
        .eq("organization_id", org.id)
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("business_hours")
        .select("weekday, start_time, end_time")
        .eq("organization_id", org.id)
        .is("professional_id", null)
        .order("weekday"),
    ]);

  const currency = { currency: org.currency, locale: org.locale };

  return (
    <main className="min-h-screen pb-28">
      {/* Hero */}
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
          <Link
            href={`/${slug}/reservar`}
            className={buttonVariants({ size: "lg", className: "mt-8" })}
          >
            Reservar turno
          </Link>
        </div>
      </section>

      {/* Services */}
      <section className="container py-12">
        <h2 className="mb-6 font-display text-2xl font-semibold">Servicios</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {(services ?? []).map((s) => (
            <div
              key={s.id}
              className="flex items-start justify-between rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <div>
                <h3 className="font-medium">{s.name}</h3>
                {s.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
                )}
                <p className="mt-2 text-sm text-muted-foreground">{s.duration_min} min</p>
              </div>
              <span className="shrink-0 font-display text-lg font-semibold text-primary">
                {formatMoney(s.price_cents, currency)}
              </span>
            </div>
          ))}
          {(services ?? []).length === 0 && (
            <p className="text-muted-foreground">Todavía no hay servicios cargados.</p>
          )}
        </div>
      </section>

      {/* Professionals */}
      {(professionals ?? []).length > 0 && (
        <section className="container py-12">
          <h2 className="mb-6 font-display text-2xl font-semibold">Profesionales</h2>
          <div className="flex flex-wrap gap-6">
            {(professionals ?? []).map((p) => (
              <div key={p.id} className="flex flex-col items-center text-center">
                <div className="flex size-20 items-center justify-center rounded-full bg-secondary font-display text-2xl text-secondary-foreground">
                  {p.name.charAt(0)}
                </div>
                <p className="mt-2 font-medium">{p.name}</p>
                {p.specialties.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {p.specialties.join(" · ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Info / hours */}
      {(hours ?? []).length > 0 && (
        <section className="container py-12">
          <h2 className="mb-6 font-display text-2xl font-semibold">Horarios</h2>
          <ul className="space-y-1 text-sm">
            {(hours ?? []).map((h, i) => (
              <li key={i} className="flex items-center gap-3 text-muted-foreground">
                <Clock className="size-4" />
                <span className="w-10 font-medium text-foreground">
                  {WEEKDAYS[h.weekday]}
                </span>
                {h.start_time.slice(0, 5)} – {h.end_time.slice(0, 5)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Sticky mobile CTA */}
      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 p-4 backdrop-blur md:hidden">
        <Link href={`/${slug}/reservar`} className={buttonVariants({ className: "w-full" })}>
          Reservar turno
        </Link>
      </div>
    </main>
  );
}
