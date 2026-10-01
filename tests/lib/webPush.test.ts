import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mockSendNotification = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({ pushSubscription: { deleteMany: vi.fn() } }));

vi.mock("web-push", () => ({ default: { sendNotification: mockSendNotification } }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import {
  getNotificationTranslator,
  getVapidPublicKey,
  getVapidSubject,
  sendPushNotification,
} from "@/lib/webPush";

const SUBSCRIPTION = { id: "sub-1", endpoint: "https://fcm.googleapis.com/fcm/send/abc", p256dh: "key", auth: "secret" };
const PAYLOAD = { title: "Stickly", body: "Hi", url: "/profile" };

function pushError(statusCode: number) {
  return Object.assign(new Error("Received unexpected response code"), { statusCode });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VAPID_PUBLIC_KEY", "public");
  vi.stubEnv("VAPID_PRIVATE_KEY", "private");
  vi.stubEnv("VAPID_SUBJECT", "mailto:hi@stickly.test");
  mockPrisma.pushSubscription.deleteMany.mockResolvedValue({ count: 1 });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getVapidPublicKey", () => {
  test("is the public key only when the whole VAPID setup is there", () => {
    const env = { VAPID_PUBLIC_KEY: "public", VAPID_PRIVATE_KEY: "private", VAPID_SUBJECT: "mailto:a@b.c" };
    expect(getVapidPublicKey(env)).toBe("public");
    expect(getVapidPublicKey({ ...env, VAPID_SUBJECT: undefined })).toBeNull();
    expect(getVapidPublicKey({ ...env, VAPID_PRIVATE_KEY: "" })).toBeNull();
  });
});

describe("getVapidSubject", () => {
  test("turns a bare email into a mailto: URL and leaves URLs alone", () => {
    expect(getVapidSubject(" hi@stickly.test ")).toBe("mailto:hi@stickly.test");
    expect(getVapidSubject("mailto:hi@stickly.test")).toBe("mailto:hi@stickly.test");
    expect(getVapidSubject("https://stickly.app")).toBe("https://stickly.app");
  });
});

describe("sendPushNotification", () => {
  test("sends the payload as JSON to the subscription, signed with the VAPID keys", async () => {
    mockSendNotification.mockResolvedValue({ statusCode: 201 });

    await expect(sendPushNotification(SUBSCRIPTION, PAYLOAD, { ttlSeconds: 60 })).resolves.toBe("sent");
    expect(mockSendNotification).toHaveBeenCalledWith(
      { endpoint: SUBSCRIPTION.endpoint, keys: { p256dh: "key", auth: "secret" } },
      JSON.stringify(PAYLOAD),
      expect.objectContaining({
        TTL: 60,
        vapidDetails: { subject: "mailto:hi@stickly.test", publicKey: "public", privateKey: "private" },
      })
    );
  });

  test.each([404, 410])("deletes a subscription the push service no longer knows (%s)", async (status) => {
    mockSendNotification.mockRejectedValue(pushError(status));

    await expect(sendPushNotification(SUBSCRIPTION, PAYLOAD, { ttlSeconds: 60 })).resolves.toBe("gone");
    expect(mockPrisma.pushSubscription.deleteMany).toHaveBeenCalledWith({ where: { id: "sub-1" } });
  });

  test("logs any other failure and keeps the subscription", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockSendNotification.mockRejectedValue(pushError(500));

    await expect(sendPushNotification(SUBSCRIPTION, PAYLOAD, { ttlSeconds: 60 })).resolves.toBe("failed");
    expect(mockPrisma.pushSubscription.deleteMany).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("sub-1"), expect.any(Error));
  });
});

describe("getNotificationTranslator", () => {
  test("uses the subscription's locale, falling back to English", () => {
    expect(getNotificationTranslator("es")("testBody")).toMatch(/funcionan/);
    expect(getNotificationTranslator("fr")("testBody")).toMatch(/work/);
  });
});
