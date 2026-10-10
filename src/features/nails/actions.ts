"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { clients, nailRecords } from "@/db/schema";
import { getCurrentOrg } from "@/features/org/current";

const WRITE_ROLES = ["owner", "admin", "professional"];

export interface NailRecordInput {
  clientId: string;
  appointmentId?: string | null;
  shape?: string;
  length?: string;
  color?: string;
  design?: string;
  technique?: string;
  product?: string;
  observations?: string;
}

function clean(v: string | undefined | null): string | null {
  const t = (v ?? "").trim();
  return t ? t.slice(0, 300) : null;
}

async function guard(clientId: string) {
  const { org, role } = await getCurrentOrg();
  if (!org || !role || !WRITE_ROLES.includes(role)) return null;
  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.organizationId, org.id)))
    .limit(1);
  if (!client) return null;
  return org;
}

/** Create a nail technical record for a client. Returns the new id so the UI
 *  can attach before/after photos to it. */
export async function createNailRecord(
  input: NailRecordInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const org = await guard(input.clientId);
  if (!org) return { ok: false, error: "No autorizado" };

  const [row] = await db
    .insert(nailRecords)
    .values({
      organizationId: org.id,
      clientId: input.clientId,
      appointmentId: input.appointmentId || null,
      shape: clean(input.shape),
      length: clean(input.length),
      color: clean(input.color),
      design: clean(input.design),
      technique: clean(input.technique),
      product: clean(input.product),
      observations: clean(input.observations),
    })
    .returning({ id: nailRecords.id });

  revalidatePath(`/dashboard/clientes/${input.clientId}`);
  return { ok: true, id: row.id };
}

export async function deleteNailRecord(id: string, clientId: string): Promise<{ ok: boolean }> {
  const org = await guard(clientId);
  if (!org) return { ok: false };
  await db.delete(nailRecords).where(and(eq(nailRecords.id, id), eq(nailRecords.organizationId, org.id)));
  revalidatePath(`/dashboard/clientes/${clientId}`);
  return { ok: true };
}
