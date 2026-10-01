import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mockQueueAll = vi.hoisted(() => vi.fn());
const mockDeliver = vi.hoisted(() => vi.fn());
const mockQStash = vi.hoisted(() => ({ isQStashConfigured: vi.fn(), isValidQStashSignature: vi.fn() }));

vi.mock("@/lib/reminders", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/reminders")>()),
  queueAllReminders: mockQueueAll,
  deliverReminder: mockDeliver,
}));
vi.mock("@/lib/qstash", () => mockQStash);
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { POST as deliver } from "@/app/api/reminders/deliver/route";
import { GET as schedule } from "@/app/api/reminders/schedule/route";

const NOTE_MESSAGE = { type: "note", noteId: "n1", remindAt: "2026-10-02T12:45:00.000Z" };

function cronRequest(authorization?: string) {
  return new NextRequest("https://stickly.test/api/reminders/schedule", {
    headers: authorization ? { authorization } : {},
  });
}

function delivery(body: string) {
  return new NextRequest("https://stickly.test/api/reminders/deliver", {
    method: "POST",
    body,
    headers: { "upstash-signature": "signed" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "cron-secret");
  mockQStash.isQStashConfigured.mockReturnValue(true);
  mockQStash.isValidQStashSignature.mockResolvedValue(true);
  mockQueueAll.mockResolvedValue({ users: 1, queued: 3 });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/reminders/schedule", () => {
  test.each([
    ["no token", undefined],
    ["a wrong token", "Bearer nope"],
  ])("rejects a request with %s", async (_case, authorization) => {
    const response = await schedule(cronRequest(authorization));
    expect(response.status).toBe(401);
    expect(mockQueueAll).not.toHaveBeenCalled();
  });

  test("rejects everything while CRON_SECRET isn't set", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const response = await schedule(cronRequest("Bearer "));
    expect(response.status).toBe(401);
  });

  test("queues the next window for Vercel Cron", async () => {
    const response = await schedule(cronRequest("Bearer cron-secret"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ users: 1, queued: 3 });
  });
});

describe("POST /api/reminders/deliver", () => {
  test("rejects a delivery not signed by QStash", async () => {
    mockQStash.isValidQStashSignature.mockResolvedValue(false);
    const response = await deliver(delivery(JSON.stringify(NOTE_MESSAGE)));
    expect(response.status).toBe(401);
    expect(mockDeliver).not.toHaveBeenCalled();
  });

  test("checks the signature against the raw body", async () => {
    const body = JSON.stringify(NOTE_MESSAGE);
    mockDeliver.mockResolvedValue("sent");
    await deliver(delivery(body));
    expect(mockQStash.isValidQStashSignature).toHaveBeenCalledWith("signed", body);
  });

  test("delivers a valid message", async () => {
    mockDeliver.mockResolvedValue("sent");
    const response = await deliver(delivery(JSON.stringify(NOTE_MESSAGE)));
    expect(response.status).toBe(200);
    expect(mockDeliver).toHaveBeenCalledWith(NOTE_MESSAGE);
  });

  test("answers 200 to a malformed message, since retrying won't help", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await deliver(delivery("{not json"));
    expect(response.status).toBe(200);
    expect(mockDeliver).not.toHaveBeenCalled();
  });

  test("answers 500 on an unexpected error so QStash retries", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockDeliver.mockRejectedValue(new Error("db down"));
    const response = await deliver(delivery(JSON.stringify(NOTE_MESSAGE)));
    expect(response.status).toBe(500);
  });
});
