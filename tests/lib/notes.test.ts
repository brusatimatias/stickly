import { describe, expect, test } from "vitest";
import { groupNotesByDay, toDraftNoteDTO } from "@/lib/notes";

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
          scheduledAt: new Date(2026, 8, 14, 9, 30),
          hasTime: true,
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
        time: "09:30",
        hasTime: true,
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
          scheduledAt: new Date(2026, 8, 14, 8, 0),
          hasTime: true,
          googleEventId: null,
        },
        {
          id: "note-b",
          title: "B",
          location: null,
          scheduledAt: new Date(2026, 8, 14, 9, 0),
          hasTime: true,
          googleEventId: null,
        },
      ],
      ["2026-09-14"]
    );

    expect(result["2026-09-14"].map((note) => note.id)).toEqual(["note-a", "note-b"]);
  });

  test("skips notes with no scheduledAt", () => {
    const result = groupNotesByDay(
      [
        {
          id: "draft-1",
          title: "Draft",
          location: null,
          scheduledAt: null,
          hasTime: true,
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
          scheduledAt: new Date(2026, 0, 1),
          hasTime: true,
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

  test("maps the draft note to a DTO with a blank time", () => {
    const dto = toDraftNoteDTO({
      id: "draft-1",
      title: "Draft",
      location: "Somewhere",
      scheduledAt: null,
      hasTime: true,
      googleEventId: null,
    });

    expect(dto).toEqual({
      id: "draft-1",
      title: "Draft",
      location: "Somewhere",
      time: "",
      hasTime: true,
      googleEventId: null,
    });
  });
});
