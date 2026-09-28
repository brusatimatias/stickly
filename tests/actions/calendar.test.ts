import { beforeEach, describe, expect, test, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  note: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
}));

const mockAuth = vi.hoisted(() => vi.fn());
const mockRevalidatePath = vi.hoisted(() => vi.fn());
const mockEventsInsert = vi.hoisted(() => vi.fn());
const mockEventsUpdate = vi.hoisted(() => vi.fn());
// The token handling is withGoogleCalendar's job (tested on its own); here it
// just runs the operation against a fake Calendar client.
const mockWithGoogleCalendar = vi.hoisted(() =>
  vi.fn((_userId: string, operation: (calendar: unknown) => unknown) =>
    operation({
      events: { insert: mockEventsInsert, update: mockEventsUpdate },
    })
  )
);

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
vi.mock("@/lib/googleCalendar", () => ({ withGoogleCalendar: mockWithGoogleCalendar }));

import { addNoteToGoogleCalendar } from "@/app/actions/calendar";

const SESSION = { user: { id: "user-1" } };

const SCHEDULED_NOTE = {
  id: "note-1",
  title: "Meeting",
  location: null,
  kind: "TIMED",
  // 22:30 on 2026-09-16 in Buenos Aires.
  startsAt: new Date("2026-09-17T01:30:00.000Z"),
  googleEventId: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(SESSION);
});

describe("addNoteToGoogleCalendar", () => {
  test("throws when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(addNoteToGoogleCalendar("note-1")).rejects.toThrow("UNAUTHORIZED");
  });

  test("throws when the note has no time set", async () => {
    mockPrisma.note.findFirst.mockResolvedValue({
      ...SCHEDULED_NOTE,
      kind: "ALL_DAY",
      startsAt: new Date("2026-09-16T00:00:00.000Z"),
    });
    await expect(addNoteToGoogleCalendar("note-1")).rejects.toThrow(
      "TIME_REQUIRED_FOR_SYNC"
    );
  });

  test("inserts a new event and persists the returned googleEventId", async () => {
    mockPrisma.note.findFirst.mockResolvedValue(SCHEDULED_NOTE);
    mockEventsInsert.mockResolvedValue({ data: { id: "gcal-new" } });

    await addNoteToGoogleCalendar("note-1");

    expect(mockEventsInsert).toHaveBeenCalledWith(
      expect.objectContaining({ calendarId: "primary" })
    );
    expect(mockEventsUpdate).not.toHaveBeenCalled();
    expect(mockPrisma.note.update).toHaveBeenCalledWith({
      where: { id: "note-1" },
      data: { googleEventId: "gcal-new" },
    });
  });

  test("sends the note's instant in UTC, an hour long", async () => {
    mockPrisma.note.findFirst.mockResolvedValue(SCHEDULED_NOTE);
    mockEventsInsert.mockResolvedValue({ data: { id: "gcal-new" } });

    await addNoteToGoogleCalendar("note-1");

    expect(mockEventsInsert.mock.calls[0][0].requestBody).toMatchObject({
      start: { dateTime: "2026-09-17T01:30:00.000Z" },
      end: { dateTime: "2026-09-17T02:30:00.000Z" },
    });
  });

  test("updates the existing event when already synced", async () => {
    mockPrisma.note.findFirst.mockResolvedValue({ ...SCHEDULED_NOTE, googleEventId: "gcal-1" });
    mockEventsUpdate.mockResolvedValue({ data: { id: "gcal-1" } });

    await addNoteToGoogleCalendar("note-1");

    expect(mockEventsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ calendarId: "primary", eventId: "gcal-1" })
    );
    expect(mockEventsInsert).not.toHaveBeenCalled();
    expect(mockPrisma.note.update).not.toHaveBeenCalled();
  });

  test("calls Calendar as the session's user and lets reconnect errors through", async () => {
    mockPrisma.note.findFirst.mockResolvedValue(SCHEDULED_NOTE);
    mockWithGoogleCalendar.mockRejectedValueOnce(new Error("GOOGLE_RECONNECT_REQUIRED"));

    await expect(addNoteToGoogleCalendar("note-1")).rejects.toThrow("GOOGLE_RECONNECT_REQUIRED");
    expect(mockWithGoogleCalendar).toHaveBeenCalledWith("user-1", expect.any(Function));
    expect(mockPrisma.note.update).not.toHaveBeenCalled();
  });

  test("rethrows other errors as-is", async () => {
    mockPrisma.note.findFirst.mockResolvedValue(SCHEDULED_NOTE);
    mockEventsInsert.mockRejectedValue(new Error("network down"));

    await expect(addNoteToGoogleCalendar("note-1")).rejects.toThrow("network down");
  });
});
