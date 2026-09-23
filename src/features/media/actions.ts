"use server";

import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations, services, professionals } from "@/db/schema";
import { getCurrentOrg } from "@/features/org/current";

export const blobConfigured = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

type Target = "org-logo" | "org-cover" | "service" | "professional";
const WRITE_ROLES = ["owner", "admin"];
const MAX_BYTES = 5 * 1024 * 1024;

async function persist(target: Target, targetId: string | null, url: string | null, orgId: string) {
  switch (target) {
    case "org-logo":
      await db.update(organizations).set({ logoUrl: url }).where(eq(organizations.id, orgId));
      break;
    case "org-cover":
      await db.update(organizations).set({ coverUrl: url }).where(eq(organizations.id, orgId));
      break;
    case "service":
      if (targetId) await db.update(services).set({ imageUrl: url }).where(and(eq(services.id, targetId), eq(services.organizationId, orgId)));
      break;
    case "professional":
      if (targetId) await db.update(professionals).set({ photoUrl: url }).where(and(eq(professionals.id, targetId), eq(professionals.organizationId, orgId)));
      break;
  }
}

export type UploadResult = { ok: true; url: string } | { ok: false; error: string };

/** Upload an image to Vercel Blob and save its URL on the target entity. */
export async function uploadImage(formData: FormData): Promise<UploadResult> {
  const { org, role } = await getCurrentOrg();
  if (!org || !role || !WRITE_ROLES.includes(role)) return { ok: false, error: "No autorizado" };
  if (!blobConfigured) return { ok: false, error: "La subida de imágenes no está configurada (falta Vercel Blob)." };

  const file = formData.get("file");
  const target = String(formData.get("target") || "") as Target;
  const targetId = (formData.get("targetId") as string) || null;

  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Archivo inválido" };
  if (!file.type.startsWith("image/")) return { ok: false, error: "El archivo debe ser una imagen" };
  if (file.size > MAX_BYTES) return { ok: false, error: "La imagen supera los 5 MB" };

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  try {
    const blob = await put(`${org.id}/${target}/${targetId ?? "org"}.${ext}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
    });
    await persist(target, targetId, blob.url, org.id);
    revalidatePath("/dashboard/configuracion");
    revalidatePath("/dashboard/servicios");
    revalidatePath("/dashboard/profesionales");
    return { ok: true, url: blob.url };
  } catch {
    return { ok: false, error: "No se pudo subir la imagen. Intentá de nuevo." };
  }
}

export async function removeImage(target: Target, targetId: string | null): Promise<{ ok: boolean }> {
  const { org, role } = await getCurrentOrg();
  if (!org || !role || !WRITE_ROLES.includes(role)) return { ok: false };
  await persist(target, targetId, null, org.id);
  revalidatePath("/dashboard/configuracion");
  revalidatePath("/dashboard/servicios");
  revalidatePath("/dashboard/profesionales");
  return { ok: true };
}
