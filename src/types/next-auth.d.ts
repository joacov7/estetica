import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
  interface User {
    /** Epoch ms of the last password change (used to invalidate old JWTs). */
    pwdAt?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    pwdAt?: number;
  }
}
