import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe auth config (no DB / bcrypt imports) — shared by the middleware
 * and the full server config. Providers are added in auth.ts.
 */
export const authConfig = {
  // Trust the deployment host (Vercel/proxy) so auth works behind their proxy.
  trustHost: true,
  pages: { signIn: "/login" },
  // Shorter sessions bound the blast radius of a stolen/kept token.
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
  providers: [],
  // Note: the real callbacks (with a DB check to invalidate tokens after a
  // password change) live in auth.ts, which runs in the Node runtime. These
  // edge-safe defaults are only used if this config is consumed without them.
  callbacks: {
    jwt({ token, user }) {
      if (user) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.uid && session.user) session.user.id = token.uid as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
