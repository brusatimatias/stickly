import { describe, expect, test } from "vitest";
import { groupNotesByDay, toDraftNoteDTO, toStoredNoteDTO } from "@/lib/noteGroups";
import type { StoredNoteDTO } from "@/components/board/types";

const BUENOS_AIRES = "America/Argentina/Buenos_Aires";

function stored(overrides: Partial<StoredNoteDTO>): StoredNoteDTO {
  return {
    id: "note",
    title: "Note",
    location: null,
    description: null,
    kind: "ALL_DAY",
    startsAt: "2026-09-14T00:00:00.000Z",
    isDone: false,
    googleEventId: null,
    ...overrides,
  };
}

describe("toStoredNoteDTO", () => {
  test("serializes the schedule as an ISO instant", () => {
    expect(
      toStoredNoteDTO({
        id: "note-1",
        title: "Standup",
        location: "Room A",
        description: null,
        kind: "TIMED",
        startsAt: new Date("2026-09-14T12:30:00.000Z"),
        isDone: false,
        googleEventId: "gcal-1",
      })
    ).toEqual({
      id: "note-1",
      title: "Standup",
      location: "Room A",
      description: null,
      kind: "TIMED",
      startsAt: "2026-09-14T12:30:00.000Z",
      isDone: false,
      googleEventId: "gcal-1",
    });
  });
});

describe("groupNotesByDay", () => {
  test("seeds every day key, even with no notes", () => {
    const result = groupNotesByDay([], ["2026-09-14", "2026-09-15"], BUENOS_AIRES);
    expect(result).toEqual({ "2026-09-14": [], "2026-09-15": [] });
  });

  test("buckets a timed note under its local day with its local time", () => {
    const result = groupNotesByDay(
      [
        stored({
          id: "note-1",
          title: "Standup",
          location: "Room A",
          kind: "TIMED",
          startsAt: "2026-09-14T12:30:00.000Z",
          googleEventId: "gcal-1",
        }),
      ],
      ["2026-09-14", "2026-09-15"],
      BUENOS_AIRES
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

  test("a late-evening note stays on its local day although it's the next day in UTC", () => {
    const result = groupNotesByDay(
      [stored({ id: "dinner", kind: "TIMED", startsAt: "2026-09-15T01:00:00.000Z" })],
      ["2026-09-14", "2026-09-15"],
      BUENOS_AIRES
    );

    expect(result["2026-09-14"].map((note) => [note.id, note.time])).toEqual([["dinner", "22:00"]]);
    expect(result["2026-09-15"]).toEqual([]);
  });

  test("an all-day note stays on its day in any zone", () => {
    const notes = [stored({ id: "bill", kind: "ALL_DAY", startsAt: "2026-09-14T00:00:00.000Z" })];

    for (const zone of [BUENOS_AIRES, "Asia/Tokyo", "Pacific/Pago_Pago"]) {
      const result = groupNotesByDay(notes, ["2026-09-13", "2026-09-14", "2026-09-15"], zone);
      expect(result["2026-09-14"].map((note) => [note.id, note.time])).toEqual([["bill", null]]);
    }
  });

  test("sorts pending notes before done notes, keeping relative order within each group", () => {
    const result = groupNotesByDay(
      [
        stored({ id: "note-a", isDone: true }),
        stored({ id: "note-b" }),
        stored({ id: "note-c", isDone: true }),
        stored({ id: "note-d" }),
      ],
      ["2026-09-14"],
      BUENOS_AIRES
    );

    expect(result["2026-09-14"].map((note) => note.id)).toEqual([
      "note-b",
      "note-d",
      "note-a",
      "note-c",
    ]);
  });

  test("skips notes with no schedule", () => {
    const result = groupNotesByDay([stored({ id: "draft-1", startsAt: null })], ["2026-09-14"], BUENOS_AIRES);
    expect(result["2026-09-14"]).toEqual([]);
  });

  test("drops notes whose local day isn't in dayKeys", () => {
    const result = groupNotesByDay(
      [stored({ startsAt: "2026-01-01T00:00:00.000Z" })],
      ["2026-09-14"],
      BUENOS_AIRES
    );
    expect(result).toEqual({ "2026-09-14": [] });
  });
});

describe("toDraftNoteDTO", () => {
  test("maps the draft note to a DTO with no time", () => {
    expect(
      toDraftNoteDTO(stored({ id: "draft-1", title: "Draft", location: "Somewhere", startsAt: null }))
    ).toEqual({
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
