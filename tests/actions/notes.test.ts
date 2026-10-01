import { beforeEach, describe, expect, test, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  note: {
    aggregate: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  $transaction: vi.fn(),
  $executeRaw: vi.fn(),
}));

const mockAuth = vi.hoisted(() => vi.fn());
const mockRevalidatePath = vi.hoisted(() => vi.fn());
const mockDeleteCalendarEvent = vi.hoisted(() => vi.fn());
const mockUpdateCalendarEvent = vi.hoisted(() => vi.fn());
// Work scheduled with `after()`, run by the tests when the response is "sent".
const afterCallbacks = vi.hoisted(() => [] as (() => Promise<void>)[]);
const mockGetTimeZoneForUser = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
vi.mock("next/server", () => ({
  after: (callback: () => Promise<void>) => afterCallbacks.push(callback),
}));
vi.mock("@/lib/googleCalendar", () => ({
  deleteCalendarEvent: mockDeleteCalendarEvent,
  updateCalendarEvent: mockUpdateCalendarEvent,
}));
vi.mock("@/lib/userTimeZone", () => ({ getTimeZoneForUser: mockGetTimeZoneForUser }));

import {
  createDraftNote,
  createNote,
  deleteNote,
  moveDraftNote,
  moveNote,
  scheduleDraftNote,
  toggleNoteDone,
  updateDraftNote,
  updateNote,
} from "@/app/actions/notes";

const SESSION = { user: { id: "user-1" } };
// 10:00 on 2026-09-16 in Buenos Aires (UTC-3).
const TIMED = { kind: "TIMED" as const, startsAt: "2026-09-16T13:00:00.000Z" };
const ALL_DAY = { kind: "ALL_DAY" as const, startsAt: "2026-09-16T00:00:00.000Z" };
// Where a note must fall to be on 2026-09-16 in Buenos Aires.
const SEPT_16_FILTER = [
  {
    kind: "TIMED",
    startsAt: { gte: new Date("2026-09-16T03:00:00.000Z"), lt: new Date("2026-09-17T03:00:00.000Z") },
  },
  {
    kind: "ALL_DAY",
    startsAt: { gte: new Date("2026-09-16T00:00:00.000Z"), lt: new Date("2026-09-17T00:00:00.000Z") },
  },
];

const runAfterCallbacks = () => Promise.all(afterCallbacks.map((callback) => callback()));

beforeEach(() => {
  vi.clearAllMocks();
  afterCallbacks.length = 0;
  mockAuth.mockResolvedValue(SESSION);
  mockGetTimeZoneForUser.mockResolvedValue("America/Argentina/Buenos_Aires");
  // $transaction runs the callback against the same mock client, since our
  // actions only use tx.note.* / tx.$executeRaw the same way as prisma.note.*.
  mockPrisma.$transaction.mockImplementation((callback: (tx: typeof mockPrisma) => unknown) =>
    callback(mockPrisma)
  );
});

describe("createNote", () => {
  const BASE = { id: "id-1", title: "Title", location: "", description: "", schedule: TIMED };

  test("throws when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(createNote(BASE)).rejects.toThrow("UNAUTHORIZED");
  });

  test("rejects an empty or oversized client id", async () => {
    mockPrisma.note.aggregate.mockResolvedValue({ _max: { position: null } });
    await expect(createNote({ ...BASE, id: "" })).rejects.toThrow("INVALID_NOTE_ID");
    await expect(createNote({ ...BASE, id: "x".repeat(65) })).rejects.toThrow("INVALID_NOTE_ID");
  });

  test("rejects a blank title", async () => {
    mockPrisma.note.aggregate.mockResolvedValue({ _max: { position: null } });
    await expect(createNote({ ...BASE, title: "   " })).rejects.toThrow("TITLE_REQUIRED");
  });

  test("stores the schedule the board sent (UTC) and the next position", async () => {
    mockPrisma.note.aggregate.mockResolvedValue({ _max: { position: 2 } });

    await createNote({ ...BASE, title: "  Buy milk  ", location: "  Store  " });

    expect(mockPrisma.note.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: "id-1",
        title: "Buy milk",
        location: "Store",
        kind: "TIMED",
        startsAt: new Date("2026-09-16T13:00:00.000Z"),
        position: 3,
        userId: "user-1",
      }),
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/");
  });

  test("creates an all-day note", async () => {
    mockPrisma.note.aggregate.mockResolvedValue({ _max: { position: null } });

    await createNote({ ...BASE, schedule: ALL_DAY });

    expect(mockPrisma.note.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: "ALL_DAY",
        startsAt: new Date("2026-09-16T00:00:00.000Z"),
        position: 0,
        location: null,
      }),
    });
  });

  test("rejects an invalid schedule before touching the database", async () => {
    await expect(
      createNote({ ...BASE, schedule: { kind: "TIMED", startsAt: "2026-02-30T10:00:00.000Z" } })
    ).rejects.toThrow("INVALID_SCHEDULE");
    await expect(
      createNote({ ...BASE, schedule: { kind: "ALL_DAY", startsAt: "2026-09-16T03:00:00.000Z" } })
    ).rejects.toThrow("INVALID_SCHEDULE");
    expect(mockPrisma.note.create).not.toHaveBeenCalled();
  });
});

describe("updateNote", () => {
  const BASE = { id: "id-1", title: "Title", location: "", description: "" };
  const EXISTING_TIMED = {
    kind: "TIMED",
    startsAt: new Date("2026-09-16T13:00:00.000Z"),
    googleEventId: "gcal-1",
  };

  test("throws when the note doesn't exist for this user", async () => {
    mockPrisma.note.findFirst.mockResolvedValue(null);
    await expect(updateNote({ ...BASE, schedule: TIMED })).rejects.toThrow("NOTE_NOT_FOUND");
  });

  test("unsyncs from Calendar and clears googleEventId when the time is removed", async () => {
    mockPrisma.note.findFirst.mockResolvedValue(EXISTING_TIMED);

    await updateNote({ ...BASE, schedule: ALL_DAY });

    expect(mockDeleteCalendarEvent).toHaveBeenCalledWith("user-1", "gcal-1");
    expect(mockPrisma.note.updateMany).toHaveBeenCalledWith({
      where: { id: "id-1", userId: "user-1" },
      data: expect.objectContaining({
        kind: "ALL_DAY",
        startsAt: new Date("2026-09-16T00:00:00.000Z"),
        googleEventId: null,
      }),
    });
  });

  test("rejects an invalid schedule", async () => {
    mockPrisma.note.findFirst.mockResolvedValue(EXISTING_TIMED);

    await expect(
      updateNote({ ...BASE, schedule: { kind: "TIMED", startsAt: "9am" } })
    ).rejects.toThrow("INVALID_SCHEDULE");
    expect(mockPrisma.note.updateMany).not.toHaveBeenCalled();
  });

  describe("keeping a synced note's Calendar event up to date", () => {
    const SYNCED = { id: "id-1", title: "Title", location: null, description: null, ...EXISTING_TIMED };

    test("updates the event after the response with the note as saved", async () => {
      const saved = { ...SYNCED, title: "New title" };
      mockPrisma.note.findFirst.mockResolvedValueOnce(SYNCED).mockResolvedValueOnce(saved);
      mockUpdateCalendarEvent.mockResolvedValue("updated");

      await updateNote({ ...BASE, title: "New title", schedule: TIMED });
      expect(mockUpdateCalendarEvent).not.toHaveBeenCalled();

      await runAfterCallbacks();
      expect(mockUpdateCalendarEvent).toHaveBeenCalledWith("user-1", "gcal-1", saved);
      expect(mockPrisma.note.updateMany).toHaveBeenCalledTimes(1);
    });

    test("doesn't call Google when nothing the event shows changed", async () => {
      mockPrisma.note.findFirst.mockResolvedValue(SYNCED);

      await updateNote({ ...BASE, schedule: TIMED });

      expect(afterCallbacks).toHaveLength(0);
    });

    test("only deletes the event (no update) when the note loses its time", async () => {
      mockPrisma.note.findFirst.mockResolvedValue(SYNCED);

      await updateNote({ ...BASE, title: "New title", schedule: ALL_DAY });

      expect(mockDeleteCalendarEvent).toHaveBeenCalledWith("user-1", "gcal-1");
      expect(afterCallbacks).toHaveLength(0);
    });

    test("doesn't call Google for a note that isn't synced", async () => {
      mockPrisma.note.findFirst.mockResolvedValue({ ...SYNCED, googleEventId: null });

      await updateNote({ ...BASE, title: "New title", schedule: TIMED });

      expect(afterCallbacks).toHaveLength(0);
    });

    test("unlinks the note when the event was deleted from Calendar", async () => {
      mockPrisma.note.findFirst.mockResolvedValue(SYNCED);
      mockUpdateCalendarEvent.mockResolvedValue("missing");

      await updateNote({ ...BASE, title: "New title", schedule: TIMED });
      await runAfterCallbacks();

      expect(mockPrisma.note.updateMany).toHaveBeenLastCalledWith({
        where: { id: "id-1", userId: "user-1", googleEventId: "gcal-1" },
        data: { googleEventId: null },
      });
    });

    test("skips the update when the note was unsynced or deleted meanwhile", async () => {
      mockPrisma.note.findFirst.mockResolvedValueOnce(SYNCED).mockResolvedValueOnce(null);

      await updateNote({ ...BASE, title: "New title", schedule: TIMED });
      await runAfterCallbacks();

      expect(mockUpdateCalendarEvent).not.toHaveBeenCalled();
    });

    test("logs instead of throwing when re-reading the note fails", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      mockPrisma.note.findFirst
        .mockResolvedValueOnce(SYNCED)
        .mockRejectedValueOnce(new Error("connection lost"));

      await updateNote({ ...BASE, title: "New title", schedule: TIMED });
      await expect(runAfterCallbacks()).resolves.toBeDefined();

      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining("note id-1"),
        expect.any(Error)
      );
    });
  });

  test("does not unsync when the note keeps a time", async () => {
    mockPrisma.note.findFirst.mockResolvedValue(EXISTING_TIMED);

    await updateNote({ ...BASE, schedule: { kind: "TIMED", startsAt: "2026-09-16T14:00:00.000Z" } });

    expect(mockDeleteCalendarEvent).not.toHaveBeenCalled();
    expect(mockPrisma.note.updateMany).toHaveBeenCalledWith({
      where: { id: "id-1", userId: "user-1" },
      data: expect.objectContaining({ kind: "TIMED", startsAt: new Date("2026-09-16T14:00:00.000Z") }),
    });
  });
});

describe("toggleNoteDone", () => {
  test("scopes the update to the current user", async () => {
    await toggleNoteDone("id-1", true);
    expect(mockPrisma.note.updateMany).toHaveBeenCalledWith({
      where: { id: "id-1", userId: "user-1" },
      data: { isDone: true },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/");
  });
});

describe("deleteNote", () => {
  test("scopes the delete to the current user", async () => {
    await deleteNote("id-1");
    expect(mockPrisma.note.deleteMany).toHaveBeenCalledWith({
      where: { id: "id-1", userId: "user-1" },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/");
  });
});

describe("createDraftNote", () => {
  const BASE = { id: "draft-2", title: "Draft", location: "", description: "" };

  test("throws when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(createDraftNote(BASE)).rejects.toThrow("UNAUTHORIZED");
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  test("rejects an empty or oversized client id", async () => {
    await expect(createDraftNote({ ...BASE, id: "" })).rejects.toThrow("INVALID_NOTE_ID");
    await expect(createDraftNote({ ...BASE, id: "x".repeat(65) })).rejects.toThrow(
      "INVALID_NOTE_ID"
    );
    expect(mockPrisma.note.create).not.toHaveBeenCalled();
  });

  test("creates the draft with the client id, last among the user's drafts", async () => {
    mockPrisma.note.aggregate.mockResolvedValue({ _count: 1, _max: { position: 0 } });

    await createDraftNote(BASE);

    expect(mockPrisma.$executeRaw).toHaveBeenCalled();
    expect(mockPrisma.note.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ id: "draft-2", isDraft: true, userId: "user-1", position: 1 }),
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/");
  });

  test("rejects a fifth draft without revalidating", async () => {
    mockPrisma.note.aggregate.mockResolvedValue({ _count: 4, _max: { position: 3 } });

    await expect(createDraftNote(BASE)).rejects.toThrow("DRAFT_LIMIT_REACHED");
    expect(mockPrisma.note.create).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});

describe("updateDraftNote", () => {
  const BASE = { id: "draft-1", title: "Draft", location: "", description: "" };

  test("throws when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(updateDraftNote(BASE)).rejects.toThrow("UNAUTHORIZED");
    expect(mockPrisma.note.updateMany).not.toHaveBeenCalled();
  });

  test("updates only a draft of the user", async () => {
    await updateDraftNote(BASE);

    expect(mockPrisma.note.updateMany).toHaveBeenCalledWith({
      where: { id: "draft-1", userId: "user-1", isDraft: true },
      data: { title: "Draft", location: null, description: null },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/");
  });

  test("rejects a blank title", async () => {
    await expect(updateDraftNote({ ...BASE, title: " " })).rejects.toThrow("TITLE_REQUIRED");
    expect(mockPrisma.note.updateMany).not.toHaveBeenCalled();
  });
});

describe("moveDraftNote", () => {
  const DRAFTS = [{ id: "a" }, { id: "b" }, { id: "c" }];

  test("throws when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(moveDraftNote({ noteId: "c", index: 0 })).rejects.toThrow("UNAUTHORIZED");
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  test("reinserts the draft at the index and renumbers the user's drafts", async () => {
    mockPrisma.note.findMany.mockResolvedValue(DRAFTS);

    await moveDraftNote({ noteId: "c", index: 0 });

    expect(mockPrisma.note.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1", isDraft: true },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
    expect(mockPrisma.note.update.mock.calls.map(([args]) => args)).toEqual([
      { where: { id: "c" }, data: { position: 0 } },
      { where: { id: "a" }, data: { position: 1 } },
      { where: { id: "b" }, data: { position: 2 } },
    ]);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/");
  });

  test("rejects a note that isn't one of the user's drafts", async () => {
    mockPrisma.note.findMany.mockResolvedValue(DRAFTS);

    await expect(moveDraftNote({ noteId: "other-user-note", index: 0 })).rejects.toThrow(
      "DRAFT_NOTE_NOT_FOUND"
    );
    expect(mockPrisma.note.update).not.toHaveBeenCalled();
  });
});

describe("moveNote", () => {
  test("reinserts against the pending-first/done-last order, not raw stored position order", async () => {
    // Stored `position` order interleaves done and pending notes (e.g. a
    // note marked done keeps its old position). The board always displays
    // pending notes before done ones (groupNotesByDay), so the `index` the
    // client sends is computed against that display order, not this one.
    mockPrisma.note.findFirst.mockResolvedValue({ id: "moving" });
    mockPrisma.note.findMany.mockResolvedValue([
      { id: "done-1", isDone: true, position: 0 },
      { id: "pending-1", isDone: false, position: 1 },
      { id: "done-2", isDone: true, position: 2 },
      { id: "pending-2", isDone: false, position: 3 },
    ]);

    // Display order is [pending-1, pending-2, done-1, done-2]; dropping the
    // moving note at index 1 means "right after pending-1".
    await moveNote({ noteId: "moving", day: "2026-09-16", index: 1, schedule: TIMED });

    const positions = Object.fromEntries(
      mockPrisma.note.update.mock.calls.map((call) => {
        const [{ where, data }] = call as [{ where: { id: string }; data: { position: number } }];
        return [where.id, data.position];
      })
    );
    expect(positions).toEqual({
      "pending-1": 0,
      moving: 1,
      "pending-2": 2,
      "done-1": 3,
      "done-2": 4,
    });
  });

  test("reorders the notes on the user's local day and stores the new schedule", async () => {
    mockPrisma.note.findFirst.mockResolvedValue({ id: "moving" });
    mockPrisma.note.findMany.mockResolvedValue([]);

    await moveNote({ noteId: "moving", day: "2026-09-16", index: 0, schedule: TIMED });

    expect(mockGetTimeZoneForUser).toHaveBeenCalledWith("user-1");
    expect(mockPrisma.note.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-1", OR: SEPT_16_FILTER }),
      })
    );
    expect(mockPrisma.note.update).toHaveBeenCalledWith({
      where: { id: "moving" },
      data: { position: 0, kind: "TIMED", startsAt: new Date("2026-09-16T13:00:00.000Z") },
    });
  });

  test("updates a synced note's Calendar event when it moves to another time", async () => {
    const moving = {
      id: "moving",
      kind: "TIMED",
      startsAt: new Date("2026-09-15T13:00:00.000Z"),
      googleEventId: "gcal-1",
    };
    mockPrisma.note.findFirst
      .mockResolvedValueOnce(moving)
      .mockResolvedValueOnce({ ...moving, startsAt: new Date(TIMED.startsAt) });
    mockPrisma.note.findMany.mockResolvedValue([]);
    mockUpdateCalendarEvent.mockResolvedValue("updated");

    await moveNote({ noteId: "moving", day: "2026-09-16", index: 0, schedule: TIMED });
    await runAfterCallbacks();

    expect(mockUpdateCalendarEvent).toHaveBeenCalledWith(
      "user-1",
      "gcal-1",
      expect.objectContaining({ startsAt: new Date(TIMED.startsAt) })
    );
  });

  test("doesn't call Google when a synced note is only reordered within its day", async () => {
    mockPrisma.note.findFirst.mockResolvedValue({
      id: "moving",
      kind: "TIMED",
      startsAt: new Date(TIMED.startsAt),
      googleEventId: "gcal-1",
    });
    mockPrisma.note.findMany.mockResolvedValue([]);

    await moveNote({ noteId: "moving", day: "2026-09-16", index: 0, schedule: TIMED });

    expect(afterCallbacks).toHaveLength(0);
  });

  test("unsyncs a synced note moved without a time, as updateNote does", async () => {
    mockPrisma.note.findFirst.mockResolvedValue({
      id: "moving",
      kind: "TIMED",
      startsAt: new Date(TIMED.startsAt),
      googleEventId: "gcal-1",
    });
    mockPrisma.note.findMany.mockResolvedValue([]);

    await moveNote({ noteId: "moving", day: "2026-09-16", index: 0, schedule: ALL_DAY });

    expect(mockDeleteCalendarEvent).toHaveBeenCalledWith("user-1", "gcal-1");
    expect(mockPrisma.note.updateMany).toHaveBeenCalledWith({
      where: { id: "moving", userId: "user-1" },
      data: { googleEventId: null },
    });
    expect(afterCallbacks).toHaveLength(0);
  });

  test("rejects an invalid schedule before touching the database", async () => {
    await expect(
      moveNote({ noteId: "moving", day: "2026-09-16", index: 0, schedule: { kind: "TIMED", startsAt: "" } })
    ).rejects.toThrow("INVALID_SCHEDULE");
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  test("throws when the note doesn't belong to this user", async () => {
    mockPrisma.note.findFirst.mockResolvedValue(null);
    await expect(
      moveNote({ noteId: "id-1", day: "2026-09-16", index: 0, schedule: TIMED })
    ).rejects.toThrow("NOTE_NOT_FOUND");
  });
});

describe("scheduleDraftNote", () => {
  test("promotes the draft to an all-day note on the user's local day", async () => {
    mockPrisma.note.findFirst.mockResolvedValue({ id: "draft-1", position: 0 });
    mockPrisma.note.findMany.mockResolvedValue([]);

    await scheduleDraftNote({ noteId: "draft-1", day: "2026-09-16", index: 0 });

    expect(mockPrisma.note.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1", isDraft: false, OR: SEPT_16_FILTER } })
    );
    expect(mockPrisma.note.update).toHaveBeenCalledWith({
      where: { id: "draft-1" },
      data: expect.objectContaining({
        isDraft: false,
        kind: "ALL_DAY",
        startsAt: new Date("2026-09-16T00:00:00.000Z"),
        position: 0,
      }),
    });
  });

  test("throws when the draft doesn't belong to this user", async () => {
    mockPrisma.note.findFirst.mockResolvedValue(null);
    await expect(
      scheduleDraftNote({ noteId: "draft-1", day: "2026-09-16", index: 0 })
    ).rejects.toThrow("DRAFT_NOTE_NOT_FOUND");
  });

  test("reinserts against the pending-first/done-last order, not raw stored position order", async () => {
    mockPrisma.note.findFirst.mockResolvedValue({ id: "draft-1" });
    mockPrisma.note.findMany.mockResolvedValue([
      { id: "done-1", isDone: true, position: 0 },
      { id: "pending-1", isDone: false, position: 1 },
      { id: "done-2", isDone: true, position: 2 },
      { id: "pending-2", isDone: false, position: 3 },
    ]);

    // Display order is [pending-1, pending-2, done-1, done-2]; promoting the
    // draft at index 1 means "right after pending-1".
    await scheduleDraftNote({ noteId: "draft-1", day: "2026-09-16", index: 1 });

    const positions = Object.fromEntries(
      mockPrisma.note.update.mock.calls.map((call) => {
        const [{ where, data }] = call as [{ where: { id: string }; data: { position: number } }];
        return [where.id, data.position];
      })
    );
    expect(positions).toEqual({
      "pending-1": 0,
      "draft-1": 1,
      "pending-2": 2,
      "done-1": 3,
      "done-2": 4,
    });
  });
});
