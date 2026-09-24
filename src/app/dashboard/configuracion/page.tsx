import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { businessHours } from "@/db/schema";
import { getCurrentOrg } from "@/features/org/current";
import { getOrgSettings } from "@/lib/settings";
import { OrgProfileForm } from "@/features/settings/org-profile-form";
import { HoursEditor, type HourRow } from "@/features/settings/hours-editor";
import { BookingSettingsForm } from "@/features/settings/booking-settings-form";
import { ReminderSettingsForm } from "@/features/settings/reminder-settings-form";
import { MarketingSettingsForm } from "@/features/settings/marketing-settings-form";
import { CostSettingsForm } from "@/features/settings/cost-settings-form";
import { PublicLink } from "@/features/settings/public-link";
import { ImageUploader } from "@/features/media/image-uploader";

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

      <div className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div>
          <h2 className="font-display text-lg font-semibold">Imágenes</h2>
          <p className="text-sm text-muted-foreground">Logo y foto de portada de tu página pública.</p>
        </div>
        <ImageUploader target="org-logo" currentUrl={org.logoUrl} shape="circle" label="Logo" />
        <div>
          <span className="mb-2 block text-sm font-medium">Portada</span>
          <ImageUploader target="org-cover" currentUrl={org.coverUrl} shape="wide" />
        </div>
      </div>

      <OrgProfileForm org={org} />
      <BookingSettingsForm initial={bookingSettings} />
      <ReminderSettingsForm initial={bookingSettings} />
      <MarketingSettingsForm initial={bookingSettings} />
      <CostSettingsForm initial={bookingSettings} />
      <HoursEditor initial={hours} />
    </div>
  );
}
