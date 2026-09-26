import { beforeEach, describe, expect, test, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  note: {
    aggregate: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { createNoteForUser } from "@/lib/noteCreation";

const INPUT = {
  title: "Call the plumber",
  location: "",
  description: "Kitchen sink",
  day: "2026-09-27",
  time: "",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.note.aggregate.mockResolvedValue({ _max: { position: 1 } });
});

describe("createNoteForUser", () => {
  test("uses the given id and returns it with the day", async () => {
    const result = await createNoteForUser("user-1", { ...INPUT, id: "client-id" });

    expect(result).toEqual({ id: "client-id", day: "2026-09-27" });
    expect(mockPrisma.note.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: "client-id",
        title: "Call the plumber",
        location: null,
        description: "Kitchen sink",
        hasTime: false,
        position: 2,
        userId: "user-1",
      }),
    });
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
