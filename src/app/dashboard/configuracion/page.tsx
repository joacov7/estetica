import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { businessHours } from "@/db/schema";
import { getCurrentOrg } from "@/features/org/current";
import { getOrgSettings } from "@/lib/settings";
import { OrgProfileForm } from "@/features/settings/org-profile-form";
import { HoursEditor, type HourRow } from "@/features/settings/hours-editor";
import { BookingSettingsForm } from "@/features/settings/booking-settings-form";
import { PublicLink } from "@/features/settings/public-link";

export const dynamic = "force-dynamic";

export default async function ConfiguracionPage() {
  const { org } = await getCurrentOrg();
  if (!org) return <p className="text-muted-foreground">Todavía no tenés un negocio.</p>;

  const [existing, bookingSettings] = await Promise.all([
    db
      .select({ weekday: businessHours.weekday, startTime: businessHours.startTime, endTime: businessHours.endTime })
      .from(businessHours)
      .where(and(eq(businessHours.organizationId, org.id), isNull(businessHours.professionalId))),
    getOrgSettings(org.id),
  ]);

  const hours: HourRow[] = Array.from({ length: 7 }, (_, wd) => {
    const row = existing.find((h) => h.weekday === wd);
    return row
      ? { weekday: wd, enabled: true, startTime: row.startTime.slice(0, 5), endTime: row.endTime.slice(0, 5) }
      : { weekday: wd, enabled: false, startTime: "10:00", endTime: "19:00" };
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">Configuración</h1>
        <p className="text-muted-foreground">Datos del negocio, horarios y tu link público.</p>
      </header>

      <PublicLink slug={org.slug} />
      <OrgProfileForm org={org} />
      <BookingSettingsForm initial={bookingSettings} />
      <HoursEditor initial={hours} />
    </div>
  );
}
