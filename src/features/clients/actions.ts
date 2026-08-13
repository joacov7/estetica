"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { clients, clientNotes } from "@/db/schema";
import { getCurrentOrg } from "@/features/org/current";

/** Add a free-text note to a client (scoped to the caller's organization). */
export async function addClientNote(clientId: string, body: string) {
  const text = body.trim();
  if (text.length === 0) return { ok: false as const, error: "La nota está vacía" };
  if (text.length > 1000) return { ok: false as const, error: "Nota demasiado larga" };

  const { org, userId } = await getCurrentOrg();
  if (!org) return { ok: false as const, error: "No autorizado" };

  // Verify the client belongs to this organization.
  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.organizationId, org.id)))
    .limit(1);
  if (!client) return { ok: false as const, error: "Clienta no encontrada" };

  await db.insert(clientNotes).values({
    organizationId: org.id,
    clientId,
    body: text,
    createdBy: userId,
  });

  revalidatePath(`/dashboard/clientes/${clientId}`);
  return { ok: true as const };
}
