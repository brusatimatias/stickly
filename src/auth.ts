import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

async function refreshGoogleAccessToken(refreshToken: string) {
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to refresh Google access token: ${response.status}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    accessTokenExpiresAt: Date.now() + data.expires_in * 1000,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          access_type: "offline",
          prompt: "consent",
          scope: `openid email profile ${GOOGLE_CALENDAR_SCOPE}`,
        },
      },
    }),
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) {
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.password) {
          return null;
        }

        const passwordMatches = await bcrypt.compare(password, user.password);
        if (!passwordMatches) {
          return null;
        }

        return { id: user.id };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile, user }) {
      // Password login: no Google tokens available in this session.
      if (account?.provider === "credentials") {
        token.userId = user!.id;
        return token;
      }

      // Initial Google sign in: upsert our own User record and persist Google tokens.
      if (account?.provider === "google" && profile) {
        const user = await prisma.user.upsert({
          where: { googleId: profile.sub as string },
          update: {
            email: profile.email as string,
            name: profile.name ?? null,
            imageUrl: (profile.picture as string) ?? null,
          },
          create: {
            googleId: profile.sub as string,
            email: profile.email as string,
            name: profile.name ?? null,
            imageUrl: (profile.picture as string) ?? null,
          },
        });

        token.userId = user.id;
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpiresAt = account.expires_at
          ? account.expires_at * 1000
          : undefined;

        return token;
      }

      // Subsequent requests: refresh the Google access token if it's expired.
      if (
        token.accessTokenExpiresAt &&
        Date.now() > (token.accessTokenExpiresAt as number) &&
        token.refreshToken
      ) {
        try {
          const refreshed = await refreshGoogleAccessToken(
            token.refreshToken as string
          );
          token.accessToken = refreshed.accessToken;
          token.accessTokenExpiresAt = refreshed.accessTokenExpiresAt;
        } catch {
          token.accessToken = undefined;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.image = (token.picture as string | undefined) ?? null;
      }
      session.accessToken = token.accessToken as string | undefined;

      return session;
    },
  },
});
