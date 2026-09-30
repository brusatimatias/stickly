import { createHmac, randomInt } from "node:crypto";

/** How long a link code can be sent from WhatsApp after it's generated. */
export const LINK_CODE_TTL_MS = 10 * 60_000;

const LINK_CODE_DIGITS = 6;

/** A random 6-digit code, leading zeros included. */
export function generateLinkCode(): string {
  return randomInt(0, 10 ** LINK_CODE_DIGITS)
    .toString()
    .padStart(LINK_CODE_DIGITS, "0");
}

/**
 * Keyed hash of a link code, stored instead of the code. With only a million
 * possible codes a plain hash would be reversed instantly from a database
 * dump; keyed with AUTH_SECRET it can't be without the key. Deterministic, so
 * the webhook can look up the code it receives.
 */
export function hashLinkCode(code: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set");
  }
  return createHmac("sha256", secret).update(`whatsapp-link:${code}`).digest("hex");
}

/**
 * The link code in a WhatsApp message, if the whole message is one: six
 * digits, allowing spaces or dashes between them ("123 456"). Returns null
 * for anything else, so ordinary messages aren't treated as guesses.
 */
export function parseLinkCode(text: string): string | null {
  const digits = text.replace(/[\s-]/g, "");
  return new RegExp(`^\\d{${LINK_CODE_DIGITS}}$`).test(digits) ? digits : null;
}
