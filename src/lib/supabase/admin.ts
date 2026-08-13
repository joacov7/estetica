import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Service-role Supabase client. BYPASSES RLS — server-side only.
 *
 * Used exclusively for trusted server operations that must act outside a user
 * session: computing availability across all appointments, and creating a
 * booking from the public (anonymous) booking flow after server-side
 * validation. NEVER import this into a Client Component — the `server-only`
 * guard makes such an import fail the build.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing Supabase admin env vars (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).",
    );
  }
  return createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
