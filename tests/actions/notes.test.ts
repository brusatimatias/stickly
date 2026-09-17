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
const mockUnsync = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
vi.mock("@/app/actions/calendar", () => ({
  unsyncNoteFromGoogleCalendar: mockUnsync,
}));

import {
  createNote,
  deleteNote,
  saveDraftNote,
  scheduleDraftNote,
  updateNote,
} from "@/app/actions/notes";

const SESSION = { user: { id: "user-1" } };

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(SESSION);
  // $transaction runs the callback against the same mock client, since our
  // actions only use tx.note.* / tx.$executeRaw the same way as prisma.note.*.
  mockPrisma.$transaction.mockImplementation((callback: (tx: typeof mockPrisma) => unknown) =>
    callback(mockPrisma)
  );
});

describe("createNote", () => {
  test("throws when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(
      createNote({ id: "id-1", title: "Title", location: "", day: "2026-09-16", time: "10:00" })
    ).rejects.toThrow("Unauthorized");
  });

  test("rejects an empty or oversized client id", async () => {
    mockPrisma.note.aggregate.mockResolvedValue({ _max: { position: null } });
    await expect(
      createNote({ id: "", title: "Title", location: "", day: "2026-09-16", time: "10:00" })
    ).rejects.toThrow("Invalid note id");
    await expect(
      createNote({
        id: "x".repeat(65),
        title: "Title",
        location: "",
        day: "2026-09-16",
        time: "10:00",
      })
    ).rejects.toThrow("Invalid note id");
  });

  test("rejects a blank title", async () => {
    mockPrisma.note.aggregate.mockResolvedValue({ _max: { position: null } });
    await expect(
      createNote({ id: "id-1", title: "   ", location: "", day: "2026-09-16", time: "10:00" })
    ).rejects.toThrow("Title is required");
  });

  test("creates a note with hasTime true and the next position", async () => {
    mockPrisma.note.aggregate.mockResolvedValue({ _max: { position: 2 } });

    await createNote({
      id: "id-1",
      title: "  Buy milk  ",
      location: "  Store  ",
      day: "2026-09-16",
      time: "10:00",
    });

    expect(mockPrisma.note.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: "id-1",
        title: "Buy milk",
        location: "Store",
        hasTime: true,
        position: 3,
        userId: "user-1",
      }),
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/");
  });

  test("creates a note with hasTime false when time is blank", async () => {
    mockPrisma.note.aggregate.mockResolvedValue({ _max: { position: null } });

    await createNote({ id: "id-1", title: "Title", location: "", day: "2026-09-16", time: "" });

    expect(mockPrisma.note.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ hasTime: false, position: 0, location: null }),
    });
  });
});

describe("updateNote", () => {
  test("throws when the note doesn't exist for this user", async () => {
    mockPrisma.note.findFirst.mockResolvedValue(null);
    await expect(
      updateNote({ id: "id-1", title: "Title", location: "", time: "10:00" })
    ).rejects.toThrow("Note not found");
  });

  test("unsyncs from Calendar and clears googleEventId when time is cleared", async () => {
    mockPrisma.note.findFirst.mockResolvedValue({
      scheduledAt: new Date("2026-09-16T10:00:00.000Z"),
      hasTime: true,
      googleEventId: "gcal-1",
    });

    await updateNote({ id: "id-1", title: "Title", location: "", time: "" });

    expect(mockUnsync).toHaveBeenCalledWith("gcal-1");
    expect(mockPrisma.note.updateMany).toHaveBeenCalledWith({
      where: { id: "id-1", userId: "user-1" },
      data: expect.objectContaining({ hasTime: false, googleEventId: null }),
    });
  });

  test("does not unsync when the note keeps a time", async () => {
    mockPrisma.note.findFirst.mockResolvedValue({
      scheduledAt: new Date("2026-09-16T10:00:00.000Z"),
      hasTime: true,
      googleEventId: "gcal-1",
    });

    await updateNote({ id: "id-1", title: "Title", location: "", time: "11:00" });

    expect(mockUnsync).not.toHaveBeenCalled();
    expect(mockPrisma.note.updateMany).toHaveBeenCalledWith({
      where: { id: "id-1", userId: "user-1" },
      data: expect.objectContaining({ hasTime: true }),
    });
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

describe("saveDraftNote", () => {
  test("updates the existing draft instead of creating a second one", async () => {
    mockPrisma.note.findFirst.mockResolvedValue({ id: "draft-1" });

    await saveDraftNote({ title: "Draft", location: "" });

    expect(mockPrisma.$executeRaw).toHaveBeenCalled();
    expect(mockPrisma.note.update).toHaveBeenCalledWith({
      where: { id: "draft-1" },
      data: { title: "Draft", location: null },
    });
    expect(mockPrisma.note.create).not.toHaveBeenCalled();
  });

  test("creates a draft when none exists yet", async () => {
    mockPrisma.note.findFirst.mockResolvedValue(null);

    await saveDraftNote({ title: "Draft", location: "" });

    expect(mockPrisma.note.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ isDraft: true, scheduledAt: null, userId: "user-1" }),
    });
  });
});

describe("scheduleDraftNote", () => {
  test("promotes the draft with no time set", async () => {
    mockPrisma.note.findFirst.mockResolvedValue({ id: "draft-1", position: 0 });
    mockPrisma.note.findMany.mockResolvedValue([]);

    await scheduleDraftNote({ noteId: "draft-1", day: "2026-09-16", index: 0 });

    expect(mockPrisma.note.update).toHaveBeenCalledWith({
      where: { id: "draft-1" },
      data: expect.objectContaining({ isDraft: false, hasTime: false, position: 0 }),
    });
  });

  test("throws when the draft doesn't belong to this user", async () => {
    mockPrisma.note.findFirst.mockResolvedValue(null);
    await expect(
      scheduleDraftNote({ noteId: "draft-1", day: "2026-09-16", index: 0 })
    ).rejects.toThrow("Draft note not found");
  });
});
