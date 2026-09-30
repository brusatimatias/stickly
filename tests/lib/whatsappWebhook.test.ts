import { createHmac } from "node:crypto";
import { describe, expect, test } from "vitest";
import {
  isValidVerifyToken,
  isValidWebhookSignature,
  parseWebhookMessages,
  toReplyNumber,
} from "@/lib/whatsappWebhook";

const SECRET = "app-secret";
const BODY = '{"entry":[]}';

function sign(body: string, secret = SECRET) {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

describe("isValidWebhookSignature", () => {
  test("accepts the HMAC of the raw body with the app secret", () => {
    expect(isValidWebhookSignature(BODY, sign(BODY), SECRET)).toBe(true);
  });

  test.each([
    ["a missing header", null],
    ["another secret", sign(BODY, "other")],
    ["another body", sign('{"entry": []}')],
    ["a malformed header", "sha256=abc"],
    ["no prefix", sign(BODY).slice("sha256=".length)],
  ])("rejects %s", (_, header) => {
    expect(isValidWebhookSignature(BODY, header, SECRET)).toBe(false);
  });

  test("rejects everything when the secret isn't set", () => {
    expect(isValidWebhookSignature(BODY, sign(BODY, ""), "")).toBe(false);
  });
});

describe("isValidVerifyToken", () => {
  test("accepts the configured token", () => {
    expect(isValidVerifyToken("verify-me", "verify-me")).toBe(true);
  });

  test.each([
    ["another token of the same length", "verify-it", "verify-me"],
    ["a shorter token", "verify", "verify-me"],
    ["a longer token", "verify-me-please", "verify-me"],
    ["an empty token", "", "verify-me"],
    ["a missing token", null, "verify-me"],
    ["any token when none is configured", "verify-me", undefined],
    ["an empty token when the configured one is empty", "", ""],
  ])("rejects %s", (_, received, expected) => {
    expect(isValidVerifyToken(received, expected)).toBe(false);
  });
});

function payload(messages: unknown[], field = "messages") {
  return { object: "whatsapp_business_account", entry: [{ changes: [{ field, value: { messages } }] }] };
}

describe("parseWebhookMessages", () => {
  test("reads text messages", () => {
    const result = parseWebhookMessages(
      payload([{ id: "wamid.1", from: "5491122334455", type: "text", text: { body: "hola" } }])
    );

    expect(result).toEqual([{ wamid: "wamid.1", from: "5491122334455", text: "hola" }]);
  });

  test("keeps non-text messages with a null text", () => {
    const result = parseWebhookMessages(payload([{ id: "wamid.2", from: "1", type: "audio", audio: {} }]));

    expect(result).toEqual([{ wamid: "wamid.2", from: "1", text: null }]);
  });

  test("yields nothing for delivery receipts or other fields", () => {
    const receipts = { entry: [{ changes: [{ field: "messages", value: { statuses: [{ id: "x" }] } }] }] };

    expect(parseWebhookMessages(receipts)).toEqual([]);
    expect(parseWebhookMessages(payload([{ id: "a", from: "1" }], "account_update"))).toEqual([]);
  });

  test.each([null, "text", {}, { entry: "x" }, { entry: [{ changes: [null] }] }])(
    "tolerates the malformed payload %j",
    (value) => {
      expect(parseWebhookMessages(value)).toEqual([]);
    }
  );

  test("skips messages without an id or sender", () => {
    expect(parseWebhookMessages(payload([{ from: "1", type: "text" }, { id: "a", type: "text" }]))).toEqual([]);
  });
});

describe("toReplyNumber", () => {
  test.each([
    ["5491122334455", "541122334455"],
    ["5215512345678", "525512345678"],
    ["15551833156", "15551833156"],
    ["541122334455", "541122334455"],
  ])("%s → %s", (from, to) => {
    expect(toReplyNumber(from)).toBe(to);
  });
});
