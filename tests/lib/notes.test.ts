import { beforeEach, describe, expect, test, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  note: { findMany: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { listNotesForUser } from "@/lib/notes";

const BUENOS_AIRES = "America/Argentina/Buenos_Aires";

function note(overrides: Partial<Record<string, unknown>>) {
  return {
    id: "note",
    title: "Note",
    location: null,
    description: null,
    kind: "ALL_DAY",
    startsAt: new Date("2026-09-21T00:00:00Z"),
    isDone: false,
    googleEventId: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listNotesForUser", () => {
  test("queries the user's scheduled notes over the whole range of local days", async () => {
    mockPrisma.note.findMany.mockResolvedValue([]);

    await listNotesForUser(
      "user-1",
      { from: "2026-09-21", to: "2026-09-27", status: "all" },
      BUENOS_AIRES
    );

    expect(mockPrisma.note.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        isDraft: false,
        OR: [
          {
            kind: "TIMED",
            startsAt: { gte: new Date("2026-09-21T03:00:00Z"), lt: new Date("2026-09-28T03:00:00Z") },
          },
          {
            kind: "ALL_DAY",
            startsAt: { gte: new Date("2026-09-21T00:00:00Z"), lt: new Date("2026-09-28T00:00:00Z") },
          },
        ],
      },
      orderBy: { position: "asc" },
    });
  });

  test("returns every day in the range, including empty ones, in local time", async () => {
    mockPrisma.note.findMany.mockResolvedValue([
      note({ id: "a", title: "Drink tea", kind: "TIMED", startsAt: new Date("2026-09-21T11:30:00Z") }),
      note({ id: "b", title: "Buy gift", startsAt: new Date("2026-09-23T00:00:00Z"), location: "Mall" }),
    ]);

    const result = await listNotesForUser(
      "user-1",
      { from: "2026-09-21", to: "2026-09-23", status: "all" },
      BUENOS_AIRES
    );

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

    const pending = await listNotesForUser("user-1", { ...input, status: "pending" }, BUENOS_AIRES);
    const done = await listNotesForUser("user-1", { ...input, status: "done" }, BUENOS_AIRES);

    expect(pending.days[0].notes.map((n) => n.title)).toEqual(["Pending"]);
    expect(done.days[0].notes.map((n) => n.title)).toEqual(["Done"]);
  });
});
