import { z } from "zod";

export const promotionFormSchema = z.object({
  name: z.string().trim().min(2, "Nombre requerido"),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]*$/, "Solo letras y números")
    .max(20)
    .optional()
    .or(z.literal("")),
  discountType: z.enum(["percentage", "fixed"]),
  discountValue: z.coerce.number().positive("Ingresá el descuento"),
});

export type PromotionFormInput = z.infer<typeof promotionFormSchema>;
