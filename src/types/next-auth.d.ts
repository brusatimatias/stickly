import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
    /** How and when the session signed in; server-only (see PRIVATE_SESSION_FIELDS). */
    authProvider?: string;
    authAt?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    /** The provider of the sign in that started this session ("google", "credentials"). */
    authProvider?: string;
    /** When that sign in happened, epoch ms. Kept as is when the token is refreshed. */
    authAt?: number;
  }
}
