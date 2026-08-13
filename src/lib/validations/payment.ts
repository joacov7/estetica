import { z } from "zod";

export const paymentFormSchema = z.object({
  kind: z.enum(["payment", "deposit", "tip", "refund"]),
  method: z.enum(["cash", "transfer", "mercadopago", "card"]),
  amount: z.coerce.number().positive("Ingresá un monto"),
});

export type PaymentFormInput = z.infer<typeof paymentFormSchema>;
