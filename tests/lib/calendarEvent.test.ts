import { describe, expect, test } from "vitest";
import { calendarEventChanged, toCalendarEvent } from "@/lib/calendarEvent";

const NOTE = {
  title: "Meeting",
  location: null,
  description: "Bring the slides",
  // 22:30 on 2026-09-16 in Buenos Aires.
  startsAt: new Date("2026-09-17T01:30:00.000Z"),
};

describe("toCalendarEvent", () => {
  test("sends the note's instant in UTC, an hour long, leaving out empty fields", () => {
    expect(toCalendarEvent(NOTE)).toEqual({
      summary: "Meeting",
      location: undefined,
      description: "Bring the slides",
      start: { dateTime: "2026-09-17T01:30:00.000Z" },
      end: { dateTime: "2026-09-17T02:30:00.000Z" },
    });
  });
});

describe("calendarEventChanged", () => {
  test("is false when nothing the event shows changed", () => {
    expect(calendarEventChanged(NOTE, { ...NOTE, startsAt: new Date(NOTE.startsAt) })).toBe(false);
  });

  test.each([
    ["title", { title: "Call" }],
    ["location", { location: "Office" }],
    ["description", { description: null }],
    ["start", { startsAt: new Date("2026-09-17T02:00:00.000Z") }],
  ])("is true when the %s changed", (_field, change) => {
    expect(calendarEventChanged(NOTE, { ...NOTE, ...change })).toBe(true);
  });
});
