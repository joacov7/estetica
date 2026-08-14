import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations, services, professionals, professionalServices } from "@/db/schema";
import { getOrgSettings } from "@/lib/settings";
import { BookingWizard } from "@/features/booking/booking-wizard";

export const dynamic = "force-dynamic";

export default async function ReservarPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ref?: string }>;
}) {
  const { slug } = await params;
  const { ref } = await searchParams;

  const [org] = await db
    .select({
      id: organizations.id,
      slug: organizations.slug,
      name: organizations.name,
      timezone: organizations.timezone,
      currency: organizations.currency,
      locale: organizations.locale,
    })
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);
  if (!org) notFound();

  const [svc, pros, profSvc] = await Promise.all([
    db
      .select({
        id: services.id,
        name: services.name,
        priceCents: services.priceCents,
        durationMin: services.durationMin,
        depositType: services.depositType,
        depositValue: services.depositValue,
      })
      .from(services)
      .where(and(eq(services.organizationId, org.id), eq(services.isActive, true)))
      .orderBy(asc(services.sortOrder)),
    db
      .select({ id: professionals.id, name: professionals.name })
      .from(professionals)
      .where(and(eq(professionals.organizationId, org.id), eq(professionals.isActive, true)))
      .orderBy(asc(professionals.sortOrder)),
    db.select().from(professionalServices),
  ]);

  const orgSettings = await getOrgSettings(org.id);

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-6">
      <Link
        href={`/${slug}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> {org.name}
      </Link>
      <BookingWizard
        org={org}
        services={svc}
        professionals={pros}
        profServices={profSvc}
        initialRef={ref ?? ""}
        advanceDays={orgSettings.advanceDays}
        cancellationWindowHours={orgSettings.cancellationWindowHours}
      />
    </main>
  );
}
