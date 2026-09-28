import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { decryptToken, encryptToken } from "@/lib/tokenCrypto";

const KEY = randomBytes(32).toString("base64");

beforeEach(() => {
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = KEY;
});

afterEach(() => {
  delete process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
});

describe("encryptToken / decryptToken", () => {
  test("round-trips a token in the versioned format, without the plaintext in it", () => {
    const encrypted = encryptToken("ya29.secret-token");

    expect(encrypted).toMatch(/^v1:[^:]+:[^:]+:[^:]+$/);
    expect(encrypted).not.toContain("secret-token");
    expect(decryptToken(encrypted)).toBe("ya29.secret-token");
  });

  test("uses a new IV each time, so the same token encrypts differently", () => {
    expect(encryptToken("same")).not.toBe(encryptToken("same"));
  });

  test("rejects a tampered ciphertext", () => {
    const [version, iv, tag] = encryptToken("ya29.secret-token").split(":");
    const tampered = [version, iv, tag, Buffer.from("something else").toString("base64")].join(":");

    expect(() => decryptToken(tampered)).toThrow();
  });

  test("rejects a value encrypted with another key", () => {
    const encrypted = encryptToken("ya29.secret-token");
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");

    expect(() => decryptToken(encrypted)).toThrow();
  });

  test.each(["plain-token", "v2:a:b:c", "v1:a:b", "v1:a:b:c:d"])(
    "rejects the unrecognized format %s",
    (value) => {
      expect(() => decryptToken(value)).toThrow("Unrecognized encrypted token format");
    }
  );

  test("requires the key to be set and 32 bytes long", () => {
    delete process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
    expect(() => encryptToken("token")).toThrow("GOOGLE_TOKEN_ENCRYPTION_KEY is not set");

    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = randomBytes(16).toString("base64");
    expect(() => encryptToken("token")).toThrow("must be 32 bytes");
  });
});
