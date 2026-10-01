import { beforeEach, describe, expect, test, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  note: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
  user: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
}));
const mockQStash = vi.hoisted(() => ({ isQStashConfigured: vi.fn(), queueReminders: vi.fn() }));
const mockSendPush = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/qstash", () => mockQStash);
vi.mock("@/lib/webPush", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/webPush")>()),
  sendPushNotification: mockSendPush,
}));
vi.mock("next/server", () => ({ after: vi.fn() }));

import {
  deliverReminder,
  parseReminderMessage,
  queueAllReminders,
  queueNoteReminder,
  queueUserReminders,
} from "@/lib/reminders";

const BA = "America/Argentina/Buenos_Aires";
// 10:00 on Friday 2026-10-02 in Buenos Aires.
const NOW = new Date("2026-10-02T13:00:00Z");
const SUBSCRIPTION = { id: "sub-1", endpoint: "https://fcm.googleapis.com/x", p256dh: "p", auth: "a", locale: "es" };

beforeEach(() => {
  vi.clearAllMocks();
  mockQStash.isQStashConfigured.mockReturnValue(true);
  mockQStash.queueReminders.mockResolvedValue(undefined);
  mockSendPush.mockResolvedValue("sent");
});

describe("parseReminderMessage", () => {
  test("accepts note and digest messages", () => {
    expect(parseReminderMessage({ type: "note", noteId: "n1", remindAt: "2026-10-02T12:45:00.000Z" })).toEqual({
      type: "note",
      noteId: "n1",
      remindAt: "2026-10-02T12:45:00.000Z",
    });
    expect(
      parseReminderMessage({ type: "digest", userId: "u1", day: "2026-10-03", at: "2026-10-03T10:00:00.000Z", x: 1 })
    ).toEqual({ type: "digest", userId: "u1", day: "2026-10-03", at: "2026-10-03T10:00:00.000Z" });
  });

  test.each([
    [{ type: "note", noteId: "n1", remindAt: "soon" }],
    [{ type: "digest", userId: "u1", day: "tomorrow", at: "2026-10-03T10:00:00.000Z" }],
    [{ type: "other" }],
    [null],
  ])("rejects %j", (input) => {
    expect(parseReminderMessage(input)).toBeNull();
  });
});

describe("queueing", () => {
  const USER = { id: "user-1", timeZone: BA, reminderMinutesBefore: 15, digestEnabled: true, digestTime: "07:00" };

  test("queues a user's notes due in the next 48 h at their reminder time, and their digests", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(USER);
    mockPrisma.note.findMany.mockResolvedValue([{ id: "n1", startsAt: new Date("2026-10-02T15:00:00Z") }]);

    await queueUserReminders("user-1", NOW);

    expect(mockPrisma.note.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          isDone: false,
          isDraft: false,
          kind: "TIMED",
          startsAt: { gte: new Date("2026-10-02T13:15:00Z"), lt: new Date("2026-10-04T13:15:00Z") },
        }),
      })
    );
    const queued = mockQStash.queueReminders.mock.calls[0][0];
    expect(queued).toEqual([
      {
        body: { type: "note", noteId: "n1", remindAt: "2026-10-02T14:45:00.000Z" },
        notBefore: new Date("2026-10-02T14:45:00Z"),
        deduplicationId: `note-n1-${new Date("2026-10-02T14:45:00Z").getTime()}`,
      },
      // Today's 07:00 already passed: tomorrow's and the day after's.
      {
        body: { type: "digest", userId: "user-1", day: "2026-10-03", at: "2026-10-03T10:00:00.000Z" },
        notBefore: new Date("2026-10-03T10:00:00Z"),
        deduplicationId: expect.stringContaining("digest-user-1-2026-10-03"),
      },
      expect.objectContaining({ body: expect.objectContaining({ day: "2026-10-04" }) }),
    ]);
  });

  test("only looks at users with something on and a device", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    await queueUserReminders("user-1", NOW);

    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "user-1",
          OR: [{ reminderMinutesBefore: { not: null } }, { digestEnabled: true }],
          pushSubscriptions: { some: {} },
        },
      })
    );
    expect(mockQStash.queueReminders).not.toHaveBeenCalled();
  });

  test("does nothing without QStash configured", async () => {
    mockQStash.isQStashConfigured.mockReturnValue(false);
    await queueUserReminders("user-1", NOW);
    await queueNoteReminder("n1", NOW);
    expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.note.findFirst).not.toHaveBeenCalled();
  });

  test("queues a single note only when its reminder falls in the window", async () => {
    mockPrisma.note.findFirst.mockResolvedValueOnce({
      id: "n1",
      startsAt: new Date("2026-10-02T15:00:00Z"),
      user: { reminderMinutesBefore: 0 },
    });
    await queueNoteReminder("n1", NOW);
    expect(mockQStash.queueReminders).toHaveBeenCalledTimes(1);

    // Its reminder time already passed (created right before it starts).
    mockPrisma.note.findFirst.mockResolvedValueOnce({
      id: "n2",
      startsAt: new Date("2026-10-02T13:05:00Z"),
      user: { reminderMinutesBefore: 10 },
    });
    await queueNoteReminder("n2", NOW);
    expect(mockQStash.queueReminders).toHaveBeenCalledTimes(1);
  });

  test("never throws when queueing fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockPrisma.note.findFirst.mockRejectedValue(new Error("db down"));
    await expect(queueNoteReminder("n1", NOW)).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
  });

  test("the daily run goes on with the other users when one fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockPrisma.user.findMany.mockResolvedValue([
      { ...USER, id: "broken", digestEnabled: false },
      { ...USER, id: "ok", reminderMinutesBefore: null },
    ]);
    mockPrisma.note.findMany.mockRejectedValueOnce(new Error("db hiccup"));

    await expect(queueAllReminders(NOW)).resolves.toEqual({ users: 2, queued: 2 });
    // Everyone's reminders go out together, in batches.
    expect(mockQStash.queueReminders).toHaveBeenCalledTimes(1);
    expect(mockQStash.queueReminders.mock.calls[0][0]).toHaveLength(2);
  });
});

describe("delivering a note reminder", () => {
  const REMIND_AT = "2026-10-02T12:45:00.000Z";
  const MESSAGE = { type: "note" as const, noteId: "n1", remindAt: REMIND_AT };
  const NOTE = {
    id: "n1",
    title: "Dentista",
    location: "Centro",
    kind: "TIMED",
    startsAt: new Date("2026-10-02T13:00:00Z"),
    isDraft: false,
    isDone: false,
    user: { timeZone: BA, reminderMinutesBefore: 15, pushSubscriptions: [SUBSCRIPTION] },
  };
  const AT_REMIND_TIME = new Date(REMIND_AT);

  test("claims it and pushes it to every device, in its language", async () => {
    mockPrisma.note.findUnique.mockResolvedValue(NOTE);
    mockPrisma.note.updateMany.mockResolvedValue({ count: 1 });

    await expect(deliverReminder(MESSAGE, AT_REMIND_TIME)).resolves.toBe("sent");

    expect(mockPrisma.note.updateMany).toHaveBeenCalledWith({
      where: { id: "n1", OR: [{ reminderSentFor: null }, { reminderSentFor: { not: AT_REMIND_TIME } }] },
      data: { reminderSentFor: AT_REMIND_TIME },
    });
    expect(mockSendPush).toHaveBeenCalledWith(
      SUBSCRIPTION,
      {
        title: "Dentista",
        body: expect.stringMatching(/^En 15 min · 10:00.* · Centro$/),
        url: "/?week=2026-10-02",
        tag: "note-n1",
      },
      { ttlSeconds: 900, urgency: "high" }
    );
  });

  test.each([
    ["the note was deleted", null],
    ["it was marked done", { ...NOTE, isDone: true }],
    ["it moved to another time", { ...NOTE, startsAt: new Date("2026-10-02T14:00:00Z") }],
    ["it lost its time", { ...NOTE, kind: "ALL_DAY" }],
    ["reminders were turned off", { ...NOTE, user: { ...NOTE.user, reminderMinutesBefore: null } }],
    ["the lead time changed", { ...NOTE, user: { ...NOTE.user, reminderMinutesBefore: 30 } }],
    ["there's no device left", { ...NOTE, user: { ...NOTE.user, pushSubscriptions: [] } }],
  ])("skips it when %s", async (_case, note) => {
    mockPrisma.note.findUnique.mockResolvedValue(note);

    await expect(deliverReminder(MESSAGE, AT_REMIND_TIME)).resolves.toBe("skipped");
    expect(mockPrisma.note.updateMany).not.toHaveBeenCalled();
    expect(mockSendPush).not.toHaveBeenCalled();
  });

  test("drops it when it arrives more than an hour late", async () => {
    mockPrisma.note.findUnique.mockResolvedValue(NOTE);
    const late = new Date(AT_REMIND_TIME.getTime() + 61 * 60_000);

    await expect(deliverReminder(MESSAGE, late)).resolves.toBe("skipped");
    expect(mockSendPush).not.toHaveBeenCalled();
  });

  test("reports it failed when no device's push service took it", async () => {
    mockPrisma.note.findUnique.mockResolvedValue(NOTE);
    mockPrisma.note.updateMany.mockResolvedValue({ count: 1 });
    mockSendPush.mockResolvedValue("gone");

    await expect(deliverReminder(MESSAGE, AT_REMIND_TIME)).resolves.toBe("failed");
  });

  test("doesn't push twice when the same reminder is delivered again", async () => {
    mockPrisma.note.findUnique.mockResolvedValue(NOTE);
    mockPrisma.note.updateMany.mockResolvedValue({ count: 0 });

    await expect(deliverReminder(MESSAGE, AT_REMIND_TIME)).resolves.toBe("skipped");
    expect(mockSendPush).not.toHaveBeenCalled();
  });

  test("says when it starts for a reminder at its time", async () => {
    mockPrisma.note.findUnique.mockResolvedValue({ ...NOTE, location: null, user: { ...NOTE.user, reminderMinutesBefore: 0 } });
    mockPrisma.note.updateMany.mockResolvedValue({ count: 1 });

    await deliverReminder({ ...MESSAGE, remindAt: "2026-10-02T13:00:00.000Z" }, new Date("2026-10-02T13:00:00Z"));

    expect(mockSendPush.mock.calls[0][1].body).toMatch(/^Ahora · 10:00/);
  });
});

describe("delivering a digest", () => {
  const MESSAGE = { type: "digest" as const, userId: "user-1", day: "2026-10-02", at: "2026-10-02T10:00:00.000Z" };
  const AT = new Date("2026-10-02T10:00:00Z");
  const USER = {
    id: "user-1",
    timeZone: BA,
    digestEnabled: true,
    digestTime: "07:00",
    pushSubscriptions: [SUBSCRIPTION],
  };

  test("lists the day's pending notes, all-day ones first, capped at five lines", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(USER);
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.note.findMany.mockResolvedValue([
      { title: "Reunión", kind: "TIMED", startsAt: new Date("2026-10-02T18:00:00Z") },
      { title: "Café", kind: "TIMED", startsAt: new Date("2026-10-02T12:00:00Z") },
      { title: "Comprar pan", kind: "ALL_DAY", startsAt: new Date("2026-10-02T00:00:00Z") },
      { title: "A", kind: "TIMED", startsAt: new Date("2026-10-02T19:00:00Z") },
      { title: "B", kind: "TIMED", startsAt: new Date("2026-10-02T20:00:00Z") },
      { title: "C", kind: "TIMED", startsAt: new Date("2026-10-02T21:00:00Z") },
    ]);

    await expect(deliverReminder(MESSAGE, AT)).resolves.toBe("sent");

    expect(mockPrisma.note.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: "user-1", isDone: false, isDraft: false }) })
    );
    const [, payload, options] = mockSendPush.mock.calls[0];
    expect(payload.title).toBe("Hoy tenés 6 notas");
    expect(payload.body.split("\n")).toEqual([
      "Comprar pan",
      expect.stringMatching(/^9:00.* Café$/),
      expect.stringMatching(/^15:00.* Reunión$/),
      expect.stringMatching(/^16:00.* A$/),
      expect.stringMatching(/^17:00.* B$/),
      "y 1 más",
    ]);
    expect(payload.url).toBe("/?week=2026-10-02");
    expect(options).toEqual({ ttlSeconds: 10800, urgency: "normal" });
  });

  test("sends nothing on a day with nothing pending", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(USER);
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.note.findMany.mockResolvedValue([]);

    await expect(deliverReminder(MESSAGE, AT)).resolves.toBe("skipped");
    expect(mockSendPush).not.toHaveBeenCalled();
  });

  test.each([
    ["the digest was turned off", { ...USER, digestEnabled: false }],
    ["its time changed", { ...USER, digestTime: "08:00" }],
    ["the user's zone changed", { ...USER, timeZone: "Europe/Madrid" }],
  ])("skips it when %s", async (_case, user) => {
    mockPrisma.user.findUnique.mockResolvedValue(user);

    await expect(deliverReminder(MESSAGE, AT)).resolves.toBe("skipped");
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
  });

  test("sends it once a day", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(USER);
    mockPrisma.user.updateMany.mockResolvedValue({ count: 0 });

    await expect(deliverReminder(MESSAGE, AT)).resolves.toBe("skipped");
    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: "user-1", OR: [{ digestSentOn: null }, { digestSentOn: { not: "2026-10-02" } }] },
      data: { digestSentOn: "2026-10-02" },
    });
    expect(mockSendPush).not.toHaveBeenCalled();
  });
});
