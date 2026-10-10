import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { authConfig } from "./auth.config";
import { db } from "@/db";
import { users } from "@/db/schema";

/** Epoch ms of a user's last password change (0 if never recorded). */
function pwdStamp(value: string | null | undefined): number {
  return value ? new Date(value).getTime() : 0;
}

/** Full auth config with the DB-backed credentials provider (Node runtime). */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (creds) => {
        const email = String(creds?.email ?? "").toLowerCase().trim();
        const password = String(creds?.password ?? "");
        if (!email || !password) return null;

        const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (!user) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          pwdAt: pwdStamp(user.passwordChangedAt),
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // Carry the password stamp in the token; on every subsequent request
    // re-check it against the DB so a password change invalidates old JWTs.
    async jwt({ token, user }) {
      if (user) {
        token.uid = (user as { id: string }).id;
        token.pwdAt = (user as { pwdAt?: number }).pwdAt ?? 0;
        return token;
      }
      if (token.uid) {
        const [u] = await db
          .select({ p: users.passwordChangedAt })
          .from(users)
          .where(eq(users.id, token.uid as string))
          .limit(1);
        if (!u || pwdStamp(u.p) !== ((token.pwdAt as number) ?? 0)) {
          delete token.uid; // stale → treated as unauthenticated
        }
      }
      return token;
    },
    session({ session, token }) {
      if (token.uid && session.user) {
        session.user.id = token.uid as string;
      } else if (session.user) {
        // Invalidated token → drop the user so gates redirect to /login.
        (session as { user?: unknown }).user = undefined;
      }
      return session;
    },
  },
});
