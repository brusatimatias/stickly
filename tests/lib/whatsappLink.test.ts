import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { generateLinkCode, hashLinkCode, parseLinkCode } from "@/lib/whatsappLink";
import { formatWhatsAppNumber, whatsAppChatUrl } from "@/lib/whatsappNumber";

describe("generateLinkCode", () => {
  test("returns six digits", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateLinkCode()).toMatch(/^\d{6}$/);
    }
  });
});

describe("hashLinkCode", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_SECRET", "secret-a");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("is deterministic for the same code and key", () => {
    expect(hashLinkCode("123456")).toBe(hashLinkCode("123456"));
    expect(hashLinkCode("123456")).not.toBe(hashLinkCode("123457"));
  });

  test("depends on the key", () => {
    const withA = hashLinkCode("123456");
    vi.stubEnv("AUTH_SECRET", "secret-b");
    expect(hashLinkCode("123456")).not.toBe(withA);
  });

  test("throws without a key", () => {
    vi.stubEnv("AUTH_SECRET", "");
    expect(() => hashLinkCode("123456")).toThrow();
  });
});

describe("parseLinkCode", () => {
  test.each([
    ["123456", "123456"],
    [" 012345 ", "012345"],
    ["123 456", "123456"],
    ["123-456", "123456"],
  ])("reads %j as a code", (text, code) => {
    expect(parseLinkCode(text)).toBe(code);
  });

  test.each(["12345", "1234567", "mi código es 123456", "recordame el 10/10", ""])(
    "ignores %j",
    (text) => {
      expect(parseLinkCode(text)).toBeNull();
    }
  );
});

describe("phone formatting", () => {
  test("shows a stored number with a plus sign", () => {
    expect(formatWhatsAppNumber("5491122334455")).toBe("+5491122334455");
  });

  test("builds a wa.me link with the digits and the encoded text", () => {
    expect(whatsAppChatUrl("+1 (555) 183-3156", "012 345")).toBe(
      "https://wa.me/15551833156?text=012%20345"
    );
  });
});
