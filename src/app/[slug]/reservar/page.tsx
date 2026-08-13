import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BookingWizard } from "@/features/booking/booking-wizard";

export const dynamic = "force-dynamic";

export default async function ReservarPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, slug, name, timezone, currency, locale")
    .eq("slug", slug)
    .single();
  if (!org) notFound();

  const [{ data: services }, { data: professionals }, { data: profServices }] =
    await Promise.all([
      supabase
        .from("services")
        .select("id, name, price_cents, duration_min, deposit_type, deposit_value")
        .eq("organization_id", org.id)
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("professionals")
        .select("id, name")
        .eq("organization_id", org.id)
        .eq("is_active", true)
        .order("sort_order"),
      supabase.from("professional_services").select("professional_id, service_id"),
    ]);

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
        services={services ?? []}
        professionals={professionals ?? []}
        profServices={profServices ?? []}
      />
    </main>
  );
}
