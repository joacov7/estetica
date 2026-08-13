"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrg } from "@/features/org/current";
import { serviceFormSchema, type ServiceFormInput } from "@/lib/validations/service";

/**
 * Resolve a writable Supabase client + org id. In production this is the
 * RLS-enforced member client; in the dev fallback (no auth yet) it uses the
 * admin client scoped to the resolved org. Remove the fallback once login exists.
 */
async function writableDb() {
  const { org, isDevFallback } = await getCurrentOrg();
  if (!org) return { db: null, orgId: null };
  const db = isDevFallback ? createAdminClient() : await createClient();
  return { db, orgId: org.id };
}

export async function createService(input: ServiceFormInput) {
  const parsed = serviceFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { db, orgId } = await writableDb();
  if (!db || !orgId) return { ok: false as const, error: "Sin organización" };

  const v = parsed.data;
  const { error } = await db.from("services").insert({
    organization_id: orgId,
    category_id: v.categoryId || null,
    name: v.name,
    description: v.description || null,
    price_cents: Math.round(v.price * 100),
    duration_min: v.durationMin,
    buffer_min: v.bufferMin,
    deposit_type: v.depositType,
    deposit_value: v.depositValue,
    is_active: v.isActive,
  });
  if (error) return { ok: false as const, error: "No se pudo guardar el servicio" };

  revalidatePath("/dashboard/servicios");
  return { ok: true as const };
}

export async function toggleService(id: string, isActive: boolean) {
  const { db } = await writableDb();
  if (!db) return { ok: false as const, error: "Sin organización" };
  const { error } = await db.from("services").update({ is_active: isActive }).eq("id", id);
  if (error) return { ok: false as const, error: "No se pudo actualizar" };
  revalidatePath("/dashboard/servicios");
  return { ok: true as const };
}
