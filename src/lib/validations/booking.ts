import { z } from "zod";

/** Public booking submission. Validated on both client and server. */
export const bookingSchema = z.object({
  organizationId: z.string().uuid(),
  professionalId: z.string().uuid(),
  serviceIds: z.array(z.string().uuid()).min(1, "Elegí al menos un servicio"),
  /** UTC ISO instant of the chosen slot start. */
  startIso: z.string().datetime(),
  client: z.object({
    name: z.string().trim().min(2, "Ingresá tu nombre"),
    phone: z
      .string()
      .trim()
      .min(6, "Ingresá un WhatsApp válido")
      .max(20)
      .regex(/^[0-9+\-\s()]+$/, "Teléfono inválido"),
    email: z.string().trim().email("Email inválido").optional().or(z.literal("")),
  }),
});

export type BookingInput = z.infer<typeof bookingSchema>;

/** Manual booking created by staff from the admin agenda. */
export const manualBookingSchema = z.object({
  professionalId: z.string().uuid(),
  serviceIds: z.array(z.string().uuid()).min(1, "Elegí un servicio"),
  startIso: z.string().datetime(),
  clientName: z.string().trim().min(2, "Ingresá el nombre"),
  clientPhone: z.string().trim().min(6, "Ingresá el WhatsApp").max(20),
});

export type ManualBookingInput = z.infer<typeof manualBookingSchema>;

export const availabilityQuerySchema = z.object({
  organizationId: z.string().uuid(),
  professionalId: z.string().uuid(),
  serviceIds: z.array(z.string().uuid()).min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
});
