import { timingSafeEqual } from "node:crypto";

/**
 * Whether a request comes from Vercel Cron: it sends `CRON_SECRET` as a
 * bearer token. Without the secret configured, nothing passes.
 */
export function isValidCronRequest(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || !authorization) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(authorization);
  return received.length === expected.length && timingSafeEqual(received, expected);
}
