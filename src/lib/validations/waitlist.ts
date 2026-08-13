import { z } from "zod";

const optId = z.string().uuid().optional().or(z.literal(""));
const optTime = z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal(""));

export const waitlistFormSchema = z.object({
  name: z.string().trim().min(2, "Ingresá el nombre"),
  phone: z.string().trim().min(6, "Ingresá el WhatsApp").max(20),
  serviceId: optId,
  professionalId: optId,
  desiredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  timeFrom: optTime,
  timeTo: optTime,
});

export type WaitlistFormInput = z.infer<typeof waitlistFormSchema>;
