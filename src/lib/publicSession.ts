/**
 * Session fields that server code needs (via `auth()`) but that must never be
 * sent to the browser. `accessToken` is a live Google token with Calendar
 * scope, so anything that can read the public session (an XSS, a malicious
 * extension) could use it.
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
