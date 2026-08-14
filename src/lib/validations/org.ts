import { z } from "zod";

export const orgProfileSchema = z.object({
  name: z.string().trim().min(2, "Nombre requerido"),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Solo minúsculas, números y guiones")
    .min(2)
    .max(40),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  address: z.string().trim().max(200).optional().or(z.literal("")),
  instagram: z.string().trim().max(100).optional().or(z.literal("")),
  whatsapp: z.string().trim().max(30).optional().or(z.literal("")),
  timezone: z.string().trim().min(1),
  currency: z.string().trim().length(3, "Código de 3 letras (ej. ARS)"),
  locale: z.string().trim().min(2),
});

export type OrgProfileInput = z.infer<typeof orgProfileSchema>;

const hourRow = z.object({
  weekday: z.number().int().min(0).max(6),
  enabled: z.boolean(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

export const businessHoursSchema = z.object({
  hours: z.array(hourRow).length(7),
});

export type BusinessHoursInput = z.infer<typeof businessHoursSchema>;

export const bookingSettingsSchema = z.object({
  advanceDays: z.coerce.number().int().min(1, "Mínimo 1 día").max(120),
  leadTimeMinutes: z.coerce.number().int().min(0).max(1440),
  cancellationWindowHours: z.coerce.number().int().min(0).max(168),
});

export type BookingSettingsInput = z.infer<typeof bookingSettingsSchema>;

export const reminderSettingsSchema = z.object({
  emailReminderEnabled: z.boolean(),
  reminderHoursAhead: z.coerce.number().int().min(1, "Mínimo 1 hora").max(48),
});

export type ReminderSettingsInput = z.infer<typeof reminderSettingsSchema>;
