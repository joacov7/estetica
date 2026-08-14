"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { servicePacks, clientPacks, clients } from "@/db/schema";
import { getCurrentOrg } from "@/features/org/current";
import { packTemplateSchema, type PackTemplateInput } from "@/lib/validations/loyalty";

const WRITE_ROLES = ["owner", "admin"];

export async function createPack(input: PackTemplateInput) {
  const parsed = packTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { org, role } = await getCurrentOrg();
  if (!org || !role || !WRITE_ROLES.includes(role)) {
    return { ok: false as const, error: "No autorizado" };
  }
  const v = parsed.data;
  await db.insert(servicePacks).values({
    organizationId: org.id,
    name: v.name,
    serviceId: v.serviceId || null,
    quantity: v.quantity,
    priceCents: Math.round(v.price * 100),
  });
  revalidatePath("/dashboard/packs");
  return { ok: true as const };
}

export async function togglePack(id: string, isActive: boolean) {
  const { org, role } = await getCurrentOrg();
  if (!org || !role || !WRITE_ROLES.includes(role)) {
    return { ok: false as const, error: "No autorizado" };
  }
  await db.update(servicePacks).set({ isActive }).where(and(eq(servicePacks.id, id), eq(servicePacks.organizationId, org.id)));
  revalidatePath("/dashboard/packs");
  return { ok: true as const };
}

/** Sell a pack template to a client — creates a client_pack snapshot. */
export async function sellPack(packId: string, clientId: string) {
  const { org } = await getCurrentOrg();
  if (!org) return { ok: false as const, error: "No autorizado" };

  const [pack] = await db
    .select()
    .from(servicePacks)
    .where(and(eq(servicePacks.id, packId), eq(servicePacks.organizationId, org.id)))
    .limit(1);
  if (!pack) return { ok: false as const, error: "Pack no encontrado" };

  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.organizationId, org.id)))
    .limit(1);
  if (!client) return { ok: false as const, error: "Clienta no encontrada" };

  await db.insert(clientPacks).values({
    organizationId: org.id,
    clientId,
    name: pack.name,
    serviceId: pack.serviceId,
    totalQty: pack.quantity,
    remainingQty: pack.quantity,
    priceCents: pack.priceCents,
  });
  revalidatePath(`/dashboard/clientes/${clientId}`);
  return { ok: true as const };
}

/** Use one credit of a client's pack (atomic decrement, never below zero). */
export async function usePack(clientPackId: string) {
  const { org } = await getCurrentOrg();
  if (!org) return { ok: false as const, error: "No autorizado" };

  // remaining_qty = remaining_qty - 1, guarded by WHERE remaining_qty > 0.
  const updated = await db
    .update(clientPacks)
    .set({ remainingQty: sql`${clientPacks.remainingQty} - 1` })
    .where(and(eq(clientPacks.id, clientPackId), eq(clientPacks.organizationId, org.id), gt(clientPacks.remainingQty, 0)))
    .returning({ id: clientPacks.id, clientId: clientPacks.clientId });

  if (updated.length === 0) return { ok: false as const, error: "El pack no tiene usos disponibles." };
  revalidatePath(`/dashboard/clientes/${updated[0].clientId}`);
  return { ok: true as const };
}
