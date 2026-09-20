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
const mockEventsDelete = vi.hoisted(() => vi.fn());
const mockSetCredentials = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
vi.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: vi.fn(function (this: { setCredentials: typeof mockSetCredentials }) {
        this.setCredentials = mockSetCredentials;
      }),
    },
    calendar: vi.fn(() => ({
      events: {
        insert: mockEventsInsert,
        update: mockEventsUpdate,
        delete: mockEventsDelete,
      },
    })),
  },
}));

import { addNoteToGoogleCalendar, unsyncNoteFromGoogleCalendar } from "@/app/actions/calendar";

const SESSION = { user: { id: "user-1" }, accessToken: "token-1" };

const SCHEDULED_NOTE = {
  id: "note-1",
  title: "Meeting",
  location: null,
  scheduledAt: new Date("2026-09-16T10:00:00.000Z"),
  hasTime: true,
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

  test("throws when there's no Google access token", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    await expect(addNoteToGoogleCalendar("note-1")).rejects.toThrow(
      "MISSING_GOOGLE_TOKEN"
    );
  });

  test("throws when the note has no time set", async () => {
    mockPrisma.note.findFirst.mockResolvedValue({ ...SCHEDULED_NOTE, hasTime: false });
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

  test("surfaces a friendly message when Google returns a 401", async () => {
    mockPrisma.note.findFirst.mockResolvedValue(SCHEDULED_NOTE);
    mockEventsInsert.mockRejectedValue({ response: { status: 401 } });

    await expect(addNoteToGoogleCalendar("note-1")).rejects.toThrow(
      "GOOGLE_SESSION_EXPIRED"
    );
  });

  test("rethrows non-auth errors as-is", async () => {
    mockPrisma.note.findFirst.mockResolvedValue(SCHEDULED_NOTE);
    mockEventsInsert.mockRejectedValue(new Error("network down"));

    await expect(addNoteToGoogleCalendar("note-1")).rejects.toThrow("network down");
  });
});

describe("unsyncNoteFromGoogleCalendar", () => {
  test("deletes the Calendar event", async () => {
    await unsyncNoteFromGoogleCalendar("gcal-1");
    expect(mockEventsDelete).toHaveBeenCalledWith({
      calendarId: "primary",
      eventId: "gcal-1",
    });
  });

  test("is a no-op without a session or access token", async () => {
    mockAuth.mockResolvedValue(null);
    await unsyncNoteFromGoogleCalendar("gcal-1");
    expect(mockEventsDelete).not.toHaveBeenCalled();
  });

  test("swallows errors instead of throwing", async () => {
    mockEventsDelete.mockRejectedValue(new Error("already deleted"));
    await expect(unsyncNoteFromGoogleCalendar("gcal-1")).resolves.toBeUndefined();
  });
});
