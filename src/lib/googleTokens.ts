import { prisma } from "@/lib/prisma";
import { decryptToken, encryptToken } from "@/lib/tokenCrypto";

/**
 * The user's Google OAuth tokens, stored encrypted on `User`. Only
 * `src/lib/googleCalendar.ts` should read them; everything else goes through
 * `withGoogleCalendar`.
 */
export type GoogleTokens = {
  refreshToken: string | null;
  accessToken: string | null;
  accessTokenExpiresAt: Date | null;
};

const NO_TOKENS: GoogleTokens = { refreshToken: null, accessToken: null, accessTokenExpiresAt: null };

export async function getGoogleTokens(userId: string): Promise<GoogleTokens> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      googleRefreshToken: true,
      googleAccessToken: true,
      googleAccessTokenExpiresAt: true,
    },
  });
  if (!user) {
    return NO_TOKENS;
  }
  try {
    return {
      refreshToken: user.googleRefreshToken && decryptToken(user.googleRefreshToken),
      accessToken: user.googleAccessToken && decryptToken(user.googleAccessToken),
      accessTokenExpiresAt: user.googleAccessTokenExpiresAt,
    };
  } catch (error) {
    // Encrypted with another key (or corrupted): unusable, so the user has
    // to sign in with Google again, same as having no tokens.
    console.error(`[google] can't decrypt the tokens of user ${userId}`, error);
    return NO_TOKENS;
  }
}

/**
 * Stores the tokens from a Google sign in or a refresh. Google only sends a
 * refresh token on some sign ins, so a missing one keeps the stored one.
 */
export async function saveGoogleTokens(
  userId: string,
  tokens: { accessToken: string; accessTokenExpiresAt: Date | null; refreshToken?: string | null }
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      googleAccessToken: encryptToken(tokens.accessToken),
      googleAccessTokenExpiresAt: tokens.accessTokenExpiresAt,
      ...(tokens.refreshToken ? { googleRefreshToken: encryptToken(tokens.refreshToken) } : {}),
    },
  });
}

/** Forgets the tokens (Google revoked them); Calendar then needs a new Google sign in. */
export async function clearGoogleTokens(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { googleRefreshToken: null, googleAccessToken: null, googleAccessTokenExpiresAt: null },
  });
}
