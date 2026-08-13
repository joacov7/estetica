import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe auth config (no DB / bcrypt imports) — shared by the middleware
 * and the full server config. Providers are added in auth.ts.
 */
export const authConfig = {
  // Trust the deployment host (Vercel/proxy) so auth works behind their proxy.
  trustHost: true,
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isDashboard = request.nextUrl.pathname.startsWith("/dashboard");
      if (isDashboard) return !!auth?.user;
      return true;
    },
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
