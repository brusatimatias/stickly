import { beforeEach, describe, expect, test, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  pushSubscription: { upsert: vi.fn(), deleteMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
}));
const mockAuth = vi.hoisted(() => vi.fn());
const mockGetLocale = vi.hoisted(() => vi.fn());
const mockSendPush = vi.hoisted(() => vi.fn());
const mockQueueUserReminders = vi.hoisted(() => vi.fn());
const afterCallbacks = vi.hoisted(() => [] as (() => unknown)[]);

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("next-intl/server", () => ({ getLocale: mockGetLocale }));
vi.mock("next/server", () => ({ after: (callback: () => unknown) => afterCallbacks.push(callback) }));
vi.mock("@/lib/reminders", () => ({ queueUserReminders: mockQueueUserReminders }));
vi.mock("@/lib/webPush", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/webPush")>()),
  sendPushNotification: mockSendPush,
}));

import { deletePushSubscription, savePushSubscription, sendTestNotification } from "@/app/actions/push";

const SESSION = { user: { id: "user-1" } };
const ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc";
const KEYS = { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQ", auth: "tBHItJI5svbpez7KI4CCXg" };
const STORED = { id: "sub-1", userId: "user-1", endpoint: ENDPOINT, ...KEYS, locale: "es" };

beforeEach(() => {
  vi.clearAllMocks();
  afterCallbacks.length = 0;
  mockAuth.mockResolvedValue(SESSION);
  mockGetLocale.mockResolvedValue("es");
});

describe("savePushSubscription", () => {
  test("rejects when there's no session", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(savePushSubscription({ endpoint: ENDPOINT, keys: KEYS })).rejects.toThrow("UNAUTHORIZED");
    expect(mockPrisma.pushSubscription.upsert).not.toHaveBeenCalled();
  });

  test("rejects a subscription that doesn't point to a push service", async () => {
    await expect(
      savePushSubscription({ endpoint: "https://example.com/hook", keys: KEYS })
    ).rejects.toThrow("INVALID_PUSH_SUBSCRIPTION");
    expect(mockPrisma.pushSubscription.upsert).not.toHaveBeenCalled();
  });

  test("stores the device for the current user and locale, taking it over if another user had it", async () => {
    mockPrisma.pushSubscription.findUnique.mockResolvedValue({ userId: "user-2" });
    await savePushSubscription({ endpoint: ENDPOINT, keys: KEYS });

    const data = { userId: "user-1", ...KEYS, locale: "es" };
    expect(mockPrisma.pushSubscription.upsert).toHaveBeenCalledWith({
      where: { endpoint: ENDPOINT },
      create: { endpoint: ENDPOINT, ...data },
      update: data,
    });
  });
});

describe("savePushSubscription queueing", () => {
  test("queues the user's reminders for a device new to them", async () => {
    mockPrisma.pushSubscription.findUnique.mockResolvedValue(null);
    await savePushSubscription({ endpoint: ENDPOINT, keys: KEYS });
    await Promise.all(afterCallbacks.map((callback) => callback()));
    expect(mockQueueUserReminders).toHaveBeenCalledWith("user-1");
  });

  test("doesn't queue again when the profile just refreshes a known device", async () => {
    mockPrisma.pushSubscription.findUnique.mockResolvedValue({ userId: "user-1" });
    await savePushSubscription({ endpoint: ENDPOINT, keys: KEYS });
    expect(afterCallbacks).toHaveLength(0);
  });
});

describe("deletePushSubscription", () => {
  test("rejects an endpoint that isn't a push service", async () => {
    await expect(deletePushSubscription("https://example.com/x")).rejects.toThrow("INVALID_PUSH_SUBSCRIPTION");
    expect(mockPrisma.pushSubscription.deleteMany).not.toHaveBeenCalled();
  });

  test("only deletes the current user's subscription", async () => {
    await deletePushSubscription(ENDPOINT);
    expect(mockPrisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { endpoint: ENDPOINT, userId: "user-1" },
    });
  });
});

describe("sendTestNotification", () => {
  test("sends a test in the device's language to the current user's device", async () => {
    mockPrisma.pushSubscription.findFirst.mockResolvedValue(STORED);
    mockSendPush.mockResolvedValue("sent");

    await sendTestNotification(ENDPOINT);

    expect(mockPrisma.pushSubscription.findFirst).toHaveBeenCalledWith({
      where: { endpoint: ENDPOINT, userId: "user-1" },
    });
    expect(mockSendPush).toHaveBeenCalledWith(
      STORED,
      expect.objectContaining({ body: expect.stringMatching(/funcionan/), url: "/profile" }),
      { ttlSeconds: 60, urgency: "high" }
    );
  });

  test("fails for a device that isn't the user's", async () => {
    mockPrisma.pushSubscription.findFirst.mockResolvedValue(null);
    await expect(sendTestNotification(ENDPOINT)).rejects.toThrow("PUSH_SUBSCRIPTION_NOT_FOUND");
    expect(mockSendPush).not.toHaveBeenCalled();
  });

  test.each([
    ["gone", "PUSH_SUBSCRIPTION_NOT_FOUND"],
    ["failed", "PUSH_SEND_FAILED"],
  ])("reports a %s send as %s", async (result, code) => {
    mockPrisma.pushSubscription.findFirst.mockResolvedValue(STORED);
    mockSendPush.mockResolvedValue(result);
    await expect(sendTestNotification(ENDPOINT)).rejects.toThrow(code);
  });
});
