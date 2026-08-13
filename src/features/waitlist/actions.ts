"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { waitlist, clients } from "@/db/schema";
import { getCurrentOrg } from "@/features/org/current";
import { waitlistFormSchema, type WaitlistFormInput } from "@/lib/validations/waitlist";

export async function addWaitlistEntry(input: WaitlistFormInput) {
  const parsed = waitlistFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { org } = await getCurrentOrg();
  if (!org) return { ok: false as const, error: "No autorizado" };
  const v = parsed.data;

  // Link (or create) the client by phone so we can show a name.
  const [client] = await db
    .insert(clients)
    .values({ organizationId: org.id, name: v.name, phone: v.phone })
    .onConflictDoUpdate({ target: [clients.organizationId, clients.phone], set: { name: v.name } })
    .returning({ id: clients.id });

  await db.insert(waitlist).values({
    organizationId: org.id,
    clientId: client.id,
    serviceId: v.serviceId || null,
    professionalId: v.professionalId || null,
    desiredDate: v.desiredDate || null,
    timeFrom: v.timeFrom || null,
    timeTo: v.timeTo || null,
    phone: v.phone,
  });

  revalidatePath("/dashboard/lista-espera");
  return { ok: true as const };
}

export async function removeWaitlistEntry(id: string) {
  const { org } = await getCurrentOrg();
  if (!org) return { ok: false as const, error: "No autorizado" };
  await db.delete(waitlist).where(and(eq(waitlist.id, id), eq(waitlist.organizationId, org.id)));
  revalidatePath("/dashboard/lista-espera");
  return { ok: true as const };
}
