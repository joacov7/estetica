import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Organization } from "@/types/database";

/**
 * Resolve the organization for the current dashboard session.
 *
 * If a member is logged in, returns their organization (RLS-safe). Until the
 * auth/login flow is wired, this falls back to the first organization so the
 * dashboard is usable in development. Replace the fallback with a redirect to
 * /login once auth is in place. The `isDevFallback` flag surfaces this in the UI.
 */
export async function getCurrentOrg(): Promise<{
  org: Organization | null;
  isDevFallback: boolean;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (membership) {
      const { data: org } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", membership.organization_id)
        .single();
      if (org) return { org, isDevFallback: false };
    }
  }

  // --- development fallback (no auth yet) ----------------------------------
  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("*")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return { org: org ?? null, isDevFallback: true };
}
