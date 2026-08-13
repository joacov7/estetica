import { z } from "zod";

/** Admin create/edit form for a service. Prices are entered in the org currency
 *  major unit (e.g. pesos) and converted to cents before persisting. */
export const serviceFormSchema = z.object({
  name: z.string().trim().min(2, "Nombre requerido"),
  categoryId: z.string().uuid().optional().or(z.literal("")),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  price: z.coerce.number().min(0, "Precio inválido"),
  durationMin: z.coerce.number().int().positive("Duración inválida"),
  bufferMin: z.coerce.number().int().min(0).default(0),
  depositType: z.enum(["none", "fixed", "percentage"]).default("none"),
  depositValue: z.coerce.number().min(0).default(0),
  isActive: z.boolean().default(true),
});

export type ServiceFormInput = z.infer<typeof serviceFormSchema>;
