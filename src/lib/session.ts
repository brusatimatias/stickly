import type { Session } from "next-auth";
import { auth } from "@/auth";

/** How recent a Google sign in must be to stand in for the current password. */
export const RECENT_SIGN_IN_MS = 10 * 60_000;

export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("UNAUTHORIZED");
  }
  return session.user.id;
}

/**
 * Whether the session signed in with Google within `RECENT_SIGN_IN_MS`.
 * Sessions from before `authAt` existed have none and count as not recent.
 */
export function isRecentGoogleSignIn(
  session: Pick<Session, "authProvider" | "authAt"> | null,
  now = Date.now()
): boolean {
  const authAt = session?.authAt;
  return (
    session?.authProvider === "google" &&
    typeof authAt === "number" &&
    authAt <= now &&
    now - authAt < RECENT_SIGN_IN_MS
  );
}

/** The current session's `isRecentGoogleSignIn`. */
export async function hasRecentGoogleSignIn(): Promise<boolean> {
  return isRecentGoogleSignIn(await auth());
}
