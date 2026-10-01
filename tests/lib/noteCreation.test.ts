import { beforeEach, describe, expect, test, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  note: {
    aggregate: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn(),
  $executeRaw: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
const mockQueueNoteReminder = vi.hoisted(() => vi.fn());
vi.mock("@/lib/reminders", () => ({ queueNoteReminderAfterResponse: mockQueueNoteReminder }));

import { createDraftNoteForUser, createNoteForUser } from "@/lib/noteCreation";

const INPUT = {
  title: "Call the plumber",
  location: "",
  description: "Kitchen sink",
  schedule: { kind: "TIMED" as const, startsAt: new Date("2026-09-27T13:00:00.000Z") },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.note.aggregate.mockResolvedValue({ _max: { position: 1 } });
  // The transaction callback runs against the same mock client.
  mockPrisma.$transaction.mockImplementation((callback: (tx: typeof mockPrisma) => unknown) =>
    callback(mockPrisma)
  );
});

describe("createNoteForUser", () => {
  test("stores the given schedule last among the user's notes, with the given id", async () => {
    const result = await createNoteForUser("user-1", { ...INPUT, id: "client-id" });

    expect(result).toEqual({ id: "client-id" });
    expect(mockPrisma.note.aggregate).toHaveBeenCalledWith({
      where: { userId: "user-1", isDraft: false },
      _max: { position: true },
    });
    expect(mockPrisma.note.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: "client-id",
        title: "Call the plumber",
        location: null,
        description: "Kitchen sink",
        kind: "TIMED",
        startsAt: new Date("2026-09-27T13:00:00.000Z"),
        position: 2,
        userId: "user-1",
      }),
    });
  });

  test("queues the reminder of a note with a time (board, chat or WhatsApp), not of an all-day one", async () => {
    await createNoteForUser("user-1", { ...INPUT, id: "timed" });
    expect(mockQueueNoteReminder).toHaveBeenCalledWith("timed");

    mockQueueNoteReminder.mockClear();
    await createNoteForUser("user-1", {
      ...INPUT,
      id: "all-day",
      schedule: { kind: "ALL_DAY", startsAt: new Date("2026-09-27T00:00:00.000Z") },
    });
    expect(mockQueueNoteReminder).not.toHaveBeenCalled();
  });

  test("generates an id when none is given", async () => {
    const result = await createNoteForUser("user-1", INPUT);

    expect(result.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(mockPrisma.note.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ id: result.id }),
    });
  });

  test("rejects a blank title before touching the database", async () => {
    await expect(createNoteForUser("user-1", { ...INPUT, title: "  " })).rejects.toThrow(
      "TITLE_REQUIRED"
    );
    expect(mockPrisma.note.aggregate).not.toHaveBeenCalled();
    expect(mockPrisma.note.create).not.toHaveBeenCalled();
  });
});

describe("createDraftNoteForUser", () => {
  const DRAFT = { title: "Buy batteries", location: "", description: "" };

  test("creates the draft last among the user's drafts, under the user's lock", async () => {
    mockPrisma.note.aggregate.mockResolvedValue({ _count: 2, _max: { position: 5 } });

    const result = await createDraftNoteForUser("user-1", { ...DRAFT, id: "client-id" });

    expect(result).toEqual({ id: "client-id" });
    expect(mockPrisma.$executeRaw).toHaveBeenCalled();
    expect(mockPrisma.note.aggregate).toHaveBeenCalledWith({
      where: { userId: "user-1", isDraft: true },
      _count: true,
      _max: { position: true },
    });
    expect(mockPrisma.note.create).toHaveBeenCalledWith({
      data: {
        id: "client-id",
        title: "Buy batteries",
        location: null,
        description: null,
        userId: "user-1",
        isDraft: true,
        position: 6,
      },
    });
  });

  test("starts at position 0 when the user has no drafts", async () => {
    mockPrisma.note.aggregate.mockResolvedValue({ _count: 0, _max: { position: null } });

    await createDraftNoteForUser("user-1", DRAFT);

    expect(mockPrisma.note.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ position: 0 }),
    });
  });

  test("rejects a fifth draft", async () => {
    mockPrisma.note.aggregate.mockResolvedValue({ _count: 4, _max: { position: 3 } });

    await expect(createDraftNoteForUser("user-1", DRAFT)).rejects.toThrow("DRAFT_LIMIT_REACHED");
    expect(mockPrisma.note.create).not.toHaveBeenCalled();
  });

  test("rejects a blank title before touching the database", async () => {
    await expect(createDraftNoteForUser("user-1", { ...DRAFT, title: " " })).rejects.toThrow(
      "TITLE_REQUIRED"
    );
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
