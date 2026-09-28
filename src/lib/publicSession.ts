/**
 * Session fields that must never be sent to the browser. `accessToken` (a
 * live Google token with Calendar scope) used to be on the session; tokens
 * now live encrypted on `User`, but it stays listed so an old session cookie
 * or a regression can't expose one. Add any new secret session field here.
 */
const PRIVATE_SESSION_FIELDS = ["accessToken"] as const;

/**
 * Returns a copy of the session JSON without the server-only fields. Passes
 * non-object values (e.g. `null` when signed out) through unchanged.
 */
export function toPublicSession(session: unknown): unknown {
  if (!session || typeof session !== "object" || Array.isArray(session)) {
    return session;
  }
  const publicSession: Record<string, unknown> = { ...session };
  for (const field of PRIVATE_SESSION_FIELDS) {
    delete publicSession[field];
  }
  return publicSession;
}
