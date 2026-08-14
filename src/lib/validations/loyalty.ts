import { z } from "zod";

export const giftCardSchema = z.object({
  amount: z.coerce.number().positive("Ingresá un monto"),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]*$/, "Solo letras y números")
    .max(16)
    .optional()
    .or(z.literal("")),
  note: z.string().trim().max(120).optional().or(z.literal("")),
});
export type GiftCardInput = z.infer<typeof giftCardSchema>;

export const redeemGiftCardSchema = z.object({
  giftCardId: z.string().uuid(),
  amount: z.coerce.number().positive("Ingresá un monto"),
});

export const packTemplateSchema = z.object({
  name: z.string().trim().min(2, "Nombre requerido"),
  serviceId: z.string().uuid().optional().or(z.literal("")),
  quantity: z.coerce.number().int().min(1, "Mínimo 1"),
  price: z.coerce.number().min(0, "Precio inválido"),
});
export type PackTemplateInput = z.infer<typeof packTemplateSchema>;
