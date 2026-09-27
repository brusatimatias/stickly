import { beforeEach, describe, expect, test, vi } from "vitest";

// Only listNotesForUser queries Prisma; the other helpers here are pure.
const mockPrisma = vi.hoisted(() => ({
  note: { findMany: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { groupNotesByDay, listNotesForUser, toDraftNoteDTO } from "@/lib/notes";

describe("groupNotesByDay", () => {
  test("seeds every day key, even with no notes", () => {
    const result = groupNotesByDay([], ["2026-09-14", "2026-09-15"]);
    expect(result).toEqual({ "2026-09-14": [], "2026-09-15": [] });
  });

  test("buckets notes under their scheduled day and maps the DTO shape", () => {
    const result = groupNotesByDay(
      [
        {
          id: "note-1",
          title: "Standup",
          location: "Room A",
          description: null,
          date: new Date("2026-09-14T00:00:00Z"),
          time: "09:30",
          isDone: false,
          googleEventId: "gcal-1",
        },
      ],
      ["2026-09-14", "2026-09-15"]
    );

    expect(result["2026-09-14"]).toEqual([
      {
        id: "note-1",
        title: "Standup",
        location: "Room A",
        description: null,
        time: "09:30",
        isDone: false,
        googleEventId: "gcal-1",
      },
    ]);
    expect(result["2026-09-15"]).toEqual([]);
  });

  test("preserves note order within a day", () => {
    const result = groupNotesByDay(
      [
        {
          id: "note-a",
          title: "A",
          location: null,
          description: null,
          date: new Date("2026-09-14T00:00:00Z"),
          time: "08:00",
          isDone: false,
          googleEventId: null,
        },
        {
          id: "note-b",
          title: "B",
          location: null,
          description: null,
          date: new Date("2026-09-14T00:00:00Z"),
          time: "09:00",
          isDone: false,
          googleEventId: null,
        },
      ],
      ["2026-09-14"]
    );

    expect(result["2026-09-14"].map((note) => note.id)).toEqual(["note-a", "note-b"]);
  });

  test("sorts pending notes before done notes, keeping relative order within each group", () => {
    const result = groupNotesByDay(
      [
        {
          id: "note-a",
          title: "A",
          location: null,
          description: null,
          date: new Date("2026-09-14T00:00:00Z"),
          time: "08:00",
          isDone: true,
          googleEventId: null,
        },
        {
          id: "note-b",
          title: "B",
          location: null,
          description: null,
          date: new Date("2026-09-14T00:00:00Z"),
          time: "09:00",
          isDone: false,
          googleEventId: null,
        },
        {
          id: "note-c",
          title: "C",
          location: null,
          description: null,
          date: new Date("2026-09-14T00:00:00Z"),
          time: "10:00",
          isDone: true,
          googleEventId: null,
        },
        {
          id: "note-d",
          title: "D",
          location: null,
          description: null,
          date: new Date("2026-09-14T00:00:00Z"),
          time: "11:00",
          isDone: false,
          googleEventId: null,
        },
      ],
      ["2026-09-14"]
    );

    expect(result["2026-09-14"].map((note) => note.id)).toEqual([
      "note-b",
      "note-d",
      "note-a",
      "note-c",
    ]);
  });

  test("skips notes with no date", () => {
    const result = groupNotesByDay(
      [
        {
          id: "draft-1",
          title: "Draft",
          location: null,
          description: null,
          date: null,
          time: null,
          isDone: false,
          googleEventId: null,
        },
      ],
      ["2026-09-14"]
    );

    expect(result["2026-09-14"]).toEqual([]);
  });

  test("drops notes whose day isn't in dayKeys", () => {
    const result = groupNotesByDay(
      [
        {
          id: "note-1",
          title: "Out of range",
          location: null,
          description: null,
          date: new Date("2026-01-01T00:00:00Z"),
          time: null,
          isDone: false,
          googleEventId: null,
        },
      ],
      ["2026-09-14"]
    );

    expect(result).toEqual({ "2026-09-14": [] });
  });
});

describe("toDraftNoteDTO", () => {
  test("returns null when there's no draft", () => {
    expect(toDraftNoteDTO(null)).toBeNull();
  });

  test("maps the draft note to a DTO with no time", () => {
    const dto = toDraftNoteDTO({
      id: "draft-1",
      title: "Draft",
      location: "Somewhere",
      description: null,
      date: null,
      time: null,
      isDone: false,
      googleEventId: null,
    });

    expect(dto).toEqual({
      id: "draft-1",
      title: "Draft",
      location: "Somewhere",
      description: null,
      time: null,
      isDone: false,
      googleEventId: null,
    });
  });
});

function note(overrides: Partial<Record<string, unknown>>) {
  return {
    id: "note",
    title: "Note",
    location: null,
    description: null,
    date: new Date("2026-09-21T00:00:00Z"),
    time: null,
    isDone: false,
    googleEventId: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listNotesForUser", () => {
  test("queries the user's scheduled notes over the whole range", async () => {
    mockPrisma.note.findMany.mockResolvedValue([]);

    await listNotesForUser("user-1", { from: "2026-09-21", to: "2026-09-27", status: "all" });

    expect(mockPrisma.note.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        isDraft: false,
        date: { gte: new Date("2026-09-21T00:00:00Z"), lt: new Date("2026-09-28T00:00:00Z") },
      },
      orderBy: { position: "asc" },
    });
  });

  test("returns every day in the range, including empty ones", async () => {
    mockPrisma.note.findMany.mockResolvedValue([
      note({ id: "a", title: "Drink tea", time: "08:30" }),
      note({ id: "b", title: "Buy gift", date: new Date("2026-09-23T00:00:00Z"), location: "Mall" }),
    ]);

    const result = await listNotesForUser("user-1", { from: "2026-09-21", to: "2026-09-23", status: "all" });

    expect(result).toEqual({
      days: [
        {
          day: "2026-09-21",
          weekday: "Monday",
          notes: [{ time: "08:30", title: "Drink tea", location: null, description: null, isDone: false }],
        },
        { day: "2026-09-22", weekday: "Tuesday", notes: [] },
        {
          day: "2026-09-23",
          weekday: "Wednesday",
          notes: [{ time: null, title: "Buy gift", location: "Mall", description: null, isDone: false }],
        },
      ],
    });
  });

  test("filters by status", async () => {
    mockPrisma.note.findMany.mockResolvedValue([
      note({ id: "a", title: "Pending", isDone: false }),
      note({ id: "b", title: "Done", isDone: true }),
    ]);
    const input = { from: "2026-09-21", to: "2026-09-21" };

    const pending = await listNotesForUser("user-1", { ...input, status: "pending" });
    const done = await listNotesForUser("user-1", { ...input, status: "done" });

    expect(pending.days[0].notes.map((n) => n.title)).toEqual(["Pending"]);
    expect(done.days[0].notes.map((n) => n.title)).toEqual(["Done"]);
  });
});
