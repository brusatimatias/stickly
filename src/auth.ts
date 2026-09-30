import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { authorizeCredentials, normalizeEmail } from "@/lib/credentials";
import { saveGoogleTokens } from "@/lib/googleTokens";
import { prisma } from "@/lib/prisma";

const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

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
      authorize(credentials) {
        return authorizeCredentials(credentials?.email, credentials?.password);
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile, user }) {
      // `account` is only there on a sign in. Remembering how and when lets a
      // recent Google sign in stand in for the current password (setPassword).
      if (account) {
        token.authProvider = account.provider;
        token.authAt = Date.now();
      }

      // Password login: no Google tokens available in this session.
      if (account?.provider === "credentials") {
        token.userId = user!.id;
        return token;
      }

      // Google sign in: upsert our own User record and store the Google tokens
      // on it (not in the JWT), so any later session of the user, password
      // ones included, can reach Calendar (see src/lib/googleCalendar.ts).
      if (account?.provider === "google" && profile) {
        const user = await prisma.user.upsert({
          where: { googleId: profile.sub as string },
          update: {
            email: normalizeEmail(profile.email as string),
            name: profile.name ?? null,
            imageUrl: (profile.picture as string) ?? null,
          },
          create: {
            googleId: profile.sub as string,
            email: normalizeEmail(profile.email as string),
            name: profile.name ?? null,
            imageUrl: (profile.picture as string) ?? null,
          },
        });

        if (account.access_token) {
          try {
            await saveGoogleTokens(user.id, {
              accessToken: account.access_token,
              refreshToken: account.refresh_token,
              accessTokenExpiresAt: account.expires_at ? new Date(account.expires_at * 1000) : null,
            });
          } catch (error) {
            // Don't block the sign in (e.g. a missing encryption key): the
            // board works, and Calendar asks for a new Google sign in.
            console.error(`[auth] couldn't store the Google tokens of user ${user.id}`, error);
          }
        }

        token.userId = user.id;
        return token;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.image = (token.picture as string | undefined) ?? null;
      }
      // Read by the server through auth(); stripped from /api/auth/session.
      session.authProvider = token.authProvider as string | undefined;
      session.authAt = token.authAt as number | undefined;
      return session;
    },
  },
});
