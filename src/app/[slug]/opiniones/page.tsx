import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Star } from "lucide-react";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations, reviews } from "@/db/schema";
import { getOrgSettings } from "@/lib/settings";
import { verifyBookingToken } from "@/lib/booking-token";
import { ReviewForm } from "@/features/reviews/review-form";

export const dynamic = "force-dynamic";

function Stars({ value, className = "size-4" }: { value: number; className?: string }) {
  return (
    <span className="inline-flex">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`${className} ${n <= value ? "fill-primary text-primary" : "text-muted-foreground/40"}`}
        />
      ))}
    </span>
  );
}

export default async function OpinionesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { slug } = await params;
  const { t } = await searchParams;

  const [org] = await db
    .select({ id: organizations.id, slug: organizations.slug, name: organizations.name })
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);
  if (!org) notFound();

  const settings = await getOrgSettings(org.id);
  const published = await db
    .select({
      id: reviews.id,
      authorName: reviews.authorName,
      rating: reviews.rating,
      comment: reviews.comment,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .where(and(eq(reviews.organizationId, org.id), eq(reviews.status, "published")))
    .orderBy(desc(reviews.isFeatured), desc(reviews.createdAt))
    .limit(50);

  const count = published.length;
  const avg = count ? published.reduce((s, r) => s + r.rating, 0) / count : 0;
  const verified = Boolean(t && verifyBookingToken(t));
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href={`/${org.slug}`}
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Volver a {org.name}
      </Link>

      <header className="mb-6">
        <h1 className="font-display text-3xl font-semibold">Opiniones</h1>
        {count > 0 ? (
          <div className="mt-2 flex items-center gap-2">
            <Stars value={Math.round(avg)} className="size-5" />
            <span className="text-sm text-muted-foreground">
              {avg.toFixed(1)} · {count} opinion{count === 1 ? "" : "es"}
            </span>
          </div>
        ) : (
          <p className="mt-1 text-muted-foreground">Todavía no hay opiniones. ¡Sé la primera!</p>
        )}
      </header>

      {settings.reviewsEnabled ? (
        <section className="mb-10">
          <h2 className="mb-3 font-display text-lg font-semibold">Dejá tu opinión</h2>
          <ReviewForm slug={org.slug} token={t} siteKey={siteKey} verified={verified} />
        </section>
      ) : (
        <p className="mb-10 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Las opiniones están momentáneamente cerradas.
        </p>
      )}

      {count > 0 && (
        <section className="space-y-4">
          {published.map((r) => (
            <article key={r.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{r.authorName}</span>
                <Stars value={r.rating} />
              </div>
              {r.comment && <p className="mt-2 text-sm text-muted-foreground">{r.comment}</p>}
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
