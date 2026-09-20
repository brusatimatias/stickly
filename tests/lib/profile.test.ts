import { describe, expect, test } from "vitest";
import { sanitizeName, validateAvatarDataUrl, validatePasswordLength } from "@/lib/profile";

describe("sanitizeName", () => {
  test("trims whitespace", () => {
    expect(sanitizeName("  Ada  ")).toBe("Ada");
  });

  test("throws when blank", () => {
    expect(() => sanitizeName("   ")).toThrow("NAME_REQUIRED");
  });

  test("truncates to the max length", () => {
    const long = "a".repeat(150);
    expect(sanitizeName(long)).toHaveLength(100);
  });
});

describe("validateAvatarDataUrl", () => {
  const tinyPng =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

  test("accepts a well-formed small image data URL", () => {
    expect(() => validateAvatarDataUrl(tinyPng)).not.toThrow();
  });

  test("rejects a non-data-URL string", () => {
    expect(() => validateAvatarDataUrl("https://example.com/avatar.png")).toThrow(
      "INVALID_IMAGE_FORMAT"
    );
  });

  test("rejects an unsupported image type", () => {
    expect(() => validateAvatarDataUrl("data:image/gif;base64,AAAA")).toThrow(
      "INVALID_IMAGE_FORMAT"
    );
  });

  test("rejects an image over the size limit", () => {
    const oversized = `data:image/png;base64,${"A".repeat(300_000)}`;
    expect(() => validateAvatarDataUrl(oversized)).toThrow("IMAGE_TOO_LARGE");
  });
});

describe("validatePasswordLength", () => {
  test("accepts a password at the minimum length", () => {
    expect(() => validatePasswordLength("12345678")).not.toThrow();
  });

  test("rejects a password shorter than the minimum", () => {
    expect(() => validatePasswordLength("short")).toThrow(
      "PASSWORD_TOO_SHORT"
    );
  });
});
