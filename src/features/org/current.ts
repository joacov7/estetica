import "server-only";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { organizations, organizationMembers } from "@/db/schema";
import type { Organization } from "@/db/schema";

/**
 * Resolve the organization for the current dashboard session, based on the
 * authenticated member. Returns null when there is no session or the user
 * has no organization yet. (/dashboard is already gated by the middleware.)
 */
export async function getCurrentOrg(): Promise<{
  org: Organization | null;
  userId: string | null;
  role: string | null;
}> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) return { org: null, userId: null, role: null };

  const [row] = await db
    .select({ org: organizations, role: organizationMembers.role })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
    .where(eq(organizationMembers.userId, userId))
    .limit(1);

  if (!row) return { org: null, userId, role: null };
  return { org: row.org, userId, role: row.role };
}
