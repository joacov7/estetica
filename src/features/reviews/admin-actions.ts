"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { reviews } from "@/db/schema";
import { getCurrentOrg } from "@/features/org/current";

const WRITE_ROLES = ["owner", "admin"];

async function guard() {
  const { org, role } = await getCurrentOrg();
  if (!org || !role || !WRITE_ROLES.includes(role)) return null;
  return org;
}

/** Approve/hide a review, or feature it on the landing page. */
export async function setReviewStatus(id: string, status: "published" | "hidden" | "pending") {
  const org = await guard();
  if (!org) return { ok: false };
  await db
    .update(reviews)
    .set({ status })
    .where(and(eq(reviews.id, id), eq(reviews.organizationId, org.id)));
  revalidatePath("/dashboard/resenas");
  return { ok: true };
}

export async function toggleReviewFeatured(id: string, isFeatured: boolean) {
  const org = await guard();
  if (!org) return { ok: false };
  await db
    .update(reviews)
    .set({ isFeatured })
    .where(and(eq(reviews.id, id), eq(reviews.organizationId, org.id)));
  revalidatePath("/dashboard/resenas");
  return { ok: true };
}

export async function deleteReview(id: string) {
  const org = await guard();
  if (!org) return { ok: false };
  await db.delete(reviews).where(and(eq(reviews.id, id), eq(reviews.organizationId, org.id)));
  revalidatePath("/dashboard/resenas");
  return { ok: true };
}
