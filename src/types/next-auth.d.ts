import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    /**
     * Server-only: read it through `auth()` in server code. It's stripped from
     * the public `/api/auth/session` response (see `src/lib/publicSession.ts`),
     * so never pass the session object to a client component.
     */
    accessToken?: string;
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpiresAt?: number;
  }
}
