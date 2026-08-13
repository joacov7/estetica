import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

/** Auth.js middleware: protects /dashboard via the `authorized` callback. */
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
