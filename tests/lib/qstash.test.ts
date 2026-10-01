import { describe, expect, test, vi } from "vitest";

const mockBatchJSON = vi.hoisted(() => vi.fn());

vi.mock("@upstash/qstash", () => ({
  Client: vi.fn(function (this: { batchJSON: typeof mockBatchJSON }) {
    this.batchJSON = mockBatchJSON;
  }),
  Receiver: vi.fn(),
}));

import { getDeliverUrl, isQStashConfigured, queueReminders } from "@/lib/qstash";

describe("isQStashConfigured", () => {
  test("is on with the dev server, or with the token and both signing keys", () => {
    expect(isQStashConfigured({ QSTASH_DEV: "true" })).toBe(true);
    expect(
      isQStashConfigured({ QSTASH_TOKEN: "t", QSTASH_CURRENT_SIGNING_KEY: "c", QSTASH_NEXT_SIGNING_KEY: "n" })
    ).toBe(true);
    expect(isQStashConfigured({ QSTASH_TOKEN: "t", QSTASH_CURRENT_SIGNING_KEY: "c" })).toBe(false);
    expect(isQStashConfigured({})).toBe(false);
  });
});

describe("getDeliverUrl", () => {
  test("is the deliver route on the app's public URL", () => {
    vi.stubEnv("SITE_URL", "https://stickly.example");
    expect(getDeliverUrl()).toBe("https://stickly.example/api/reminders/deliver");
    vi.unstubAllEnvs();
  });
});

describe("queueReminders", () => {
  test("publishes in batches of 100, each at its time, to the deliver route", async () => {
    vi.stubEnv("SITE_URL", "https://stickly.example");
    const at = new Date("2026-10-02T12:45:00Z");
    const reminders = Array.from({ length: 150 }, (_, i) => ({
      body: { i },
      notBefore: at,
      deduplicationId: `id-${i}`,
    }));

    await queueReminders(reminders);

    expect(mockBatchJSON).toHaveBeenCalledTimes(2);
    expect(mockBatchJSON.mock.calls[0][0]).toHaveLength(100);
    expect(mockBatchJSON.mock.calls[1][0][0]).toEqual({
      url: "https://stickly.example/api/reminders/deliver",
      body: { i: 100 },
      notBefore: at.getTime() / 1000,
      deduplicationId: "id-100",
      retries: 2,
    });
    vi.unstubAllEnvs();
  });

  test("publishes nothing when there's nothing to queue", async () => {
    mockBatchJSON.mockClear();
    await queueReminders([]);
    expect(mockBatchJSON).not.toHaveBeenCalled();
  });
});
