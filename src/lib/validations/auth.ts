import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Ingresá tu nombre"),
  email: z.string().trim().toLowerCase().email("Email inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  orgName: z.string().trim().min(2, "Ingresá el nombre del negocio"),
});

export type SignupInput = z.infer<typeof signupSchema>;

/** Turn a business name into a URL-safe slug. */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
