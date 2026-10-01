import { describe, expect, test } from "vitest";
import { isPushServiceUrl, parsePushEndpoint, parsePushSubscription } from "@/lib/pushSubscription";

const KEYS = { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQ", auth: "tBHItJI5svbpez7KI4CCXg" };
const CHROME = "https://fcm.googleapis.com/fcm/send/abc:def";

describe("isPushServiceUrl", () => {
  test.each([
    CHROME,
    "https://updates.push.services.mozilla.com/wpush/v2/abc",
    "https://web.push.apple.com/QAbc",
    "https://wns2-par02p.notify.windows.com/w/?token=abc",
  ])("accepts the push service at %s", (url) => {
    expect(isPushServiceUrl(url)).toBe(true);
  });

  test.each([
    ["any other host", "https://example.com/push"],
    ["a look-alike host", "https://evilfcm.googleapis.com.example.com/x"],
    ["a host that only ends like one", "https://notpush.apple.com.evil.io/x"],
    ["plain http", "http://fcm.googleapis.com/fcm/send/abc"],
    ["another port", "https://fcm.googleapis.com:8443/fcm/send/abc"],
    ["credentials in the URL", "https://user:pass@fcm.googleapis.com/fcm/send/abc"],
    ["something that isn't a URL", "fcm.googleapis.com"],
  ])("rejects %s", (_case, url) => {
    expect(isPushServiceUrl(url)).toBe(false);
  });
});

describe("parsePushSubscription", () => {
  test("returns the endpoint and keys of a valid subscription, dropping anything else", () => {
    expect(parsePushSubscription({ endpoint: CHROME, expirationTime: null, keys: KEYS })).toEqual({
      endpoint: CHROME,
      keys: KEYS,
    });
  });

  test.each([
    ["nothing", undefined],
    ["an endpoint outside the push services", { endpoint: "https://example.com/x", keys: KEYS }],
    ["an oversized endpoint", { endpoint: `${CHROME}${"a".repeat(2048)}`, keys: KEYS }],
    ["missing keys", { endpoint: CHROME }],
    ["a key that isn't base64url", { endpoint: CHROME, keys: { ...KEYS, auth: "not base64!" } }],
    ["an oversized key", { endpoint: CHROME, keys: { ...KEYS, p256dh: "a".repeat(257) } }],
  ])("rejects %s", (_case, input) => {
    expect(() => parsePushSubscription(input)).toThrow("INVALID_PUSH_SUBSCRIPTION");
  });
});

describe("parsePushEndpoint", () => {
  test("accepts a push service URL and rejects anything else", () => {
    expect(parsePushEndpoint(CHROME)).toBe(CHROME);
    expect(() => parsePushEndpoint("https://example.com/x")).toThrow("INVALID_PUSH_SUBSCRIPTION");
    expect(() => parsePushEndpoint(42)).toThrow("INVALID_PUSH_SUBSCRIPTION");
  });
});
