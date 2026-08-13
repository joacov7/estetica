import { z } from "zod";

/** Admin create/edit form for a professional. */
export const professionalFormSchema = z.object({
  name: z.string().trim().min(2, "Nombre requerido"),
  // Comma-separated in the UI; normalized to an array before persisting.
  specialties: z.string().trim().optional().default(""),
  isActive: z.boolean().default(true),
});

export type ProfessionalFormInput = z.infer<typeof professionalFormSchema>;

/** "Soft Gel, Nail Art" → ["Soft Gel", "Nail Art"] */
export function parseSpecialties(input: string): string[] {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
