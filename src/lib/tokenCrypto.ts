import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Encryption at rest for the Google OAuth tokens stored on `User`, so a copy
 * of the database alone doesn't grant access to anyone's calendar.
 *
 * AES-256-GCM (authenticated: a tampered value fails to decrypt) with the key
 * in GOOGLE_TOKEN_ENCRYPTION_KEY (32 random bytes, base64). Stored values are
 * `v1:<iv>:<auth tag>:<ciphertext>` in base64; the version prefix leaves room
 * to rotate the key or algorithm later without guessing what an old value is.
 */
const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;

function getKey(): Buffer {
  const raw = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY is not set");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(`GOOGLE_TOKEN_ENCRYPTION_KEY must be ${KEY_BYTES} bytes, base64-encoded`);
  }
  return key;
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), ciphertext]
    .map((part) => (typeof part === "string" ? part : part.toString("base64")))
    .join(":");
}

/** Throws if the value is malformed, was tampered with, or used another key. */
export function decryptToken(stored: string): string {
  const [version, iv, authTag, ciphertext, ...rest] = stored.split(":");
  if (version !== VERSION || !iv || !authTag || ciphertext === undefined || rest.length > 0) {
    throw new Error("Unrecognized encrypted token format");
  }
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
