import { describe, expect, test } from "vitest";
import {
  localDaysFilter,
  parseScheduleInput,
  toLocalSchedule,
  toScheduleInput,
  toStoredSchedule,
  zonedTimeToUtc,
} from "@/lib/schedule";

const BUENOS_AIRES = "America/Argentina/Buenos_Aires"; // UTC-3, no DST
const MIAMI = "America/New_York"; // UTC-4 in September (DST), UTC-5 in winter
const MADRID = "Europe/Madrid";

describe("zonedTimeToUtc", () => {
  test("converts a wall-clock time in a zone to its instant", () => {
    expect(zonedTimeToUtc("2026-09-28", "10:00", BUENOS_AIRES).toISOString()).toBe(
      "2026-09-28T13:00:00.000Z"
    );
  });

  test("rolls over to the next UTC day", () => {
    expect(zonedTimeToUtc("2026-09-28", "22:00", BUENOS_AIRES).toISOString()).toBe(
      "2026-09-29T01:00:00.000Z"
    );
  });

  test("uses the offset in effect on that day (DST)", () => {
    expect(zonedTimeToUtc("2026-07-01", "12:00", MADRID).toISOString()).toBe(
      "2026-07-01T10:00:00.000Z"
    );
    expect(zonedTimeToUtc("2026-12-01", "12:00", MADRID).toISOString()).toBe(
      "2026-12-01T11:00:00.000Z"
    );
  });

  test("handles the day DST starts", () => {
    // Madrid jumps from 02:00 to 03:00 on 2026-03-29.
    expect(zonedTimeToUtc("2026-03-29", "01:30", MADRID).toISOString()).toBe(
      "2026-03-29T00:30:00.000Z"
    );
    expect(zonedTimeToUtc("2026-03-29", "03:30", MADRID).toISOString()).toBe(
      "2026-03-29T01:30:00.000Z"
    );
  });
});

describe("toStoredSchedule / toLocalSchedule", () => {
  test("a timed note is shown at the same instant in another zone", () => {
    const stored = toStoredSchedule("2026-09-28", "10:00", BUENOS_AIRES);

    expect(stored).toEqual({ kind: "TIMED", startsAt: new Date("2026-09-28T13:00:00.000Z") });
    expect(toLocalSchedule(stored.startsAt, stored.kind, BUENOS_AIRES)).toEqual({
      day: "2026-09-28",
      time: "10:00",
    });
    expect(toLocalSchedule(stored.startsAt, stored.kind, MIAMI)).toEqual({
      day: "2026-09-28",
      time: "09:00",
    });
  });

  test("a timed note can land on another local day", () => {
    const stored = toStoredSchedule("2026-09-28", "22:00", BUENOS_AIRES);

    expect(toLocalSchedule(stored.startsAt, stored.kind, "Asia/Tokyo")).toEqual({
      day: "2026-09-29",
      time: "10:00",
    });
  });

  test("an all-day note keeps its day in every zone", () => {
    const stored = toStoredSchedule("2026-09-26", null, BUENOS_AIRES);

    expect(stored).toEqual({ kind: "ALL_DAY", startsAt: new Date("2026-09-26T00:00:00.000Z") });
    for (const zone of [BUENOS_AIRES, MIAMI, "Asia/Tokyo", "Pacific/Kiritimati", "Pacific/Pago_Pago"]) {
      expect(toLocalSchedule(stored.startsAt, stored.kind, zone)).toEqual({
        day: "2026-09-26",
        time: null,
      });
    }
  });
});

describe("localDaysFilter", () => {
  test("covers the local days for timed notes and the plain days for all-day ones", () => {
    expect(localDaysFilter("2026-09-21", "2026-09-28", BUENOS_AIRES)).toEqual([
      {
        kind: "TIMED",
        startsAt: {
          gte: new Date("2026-09-21T03:00:00.000Z"),
          lt: new Date("2026-09-28T03:00:00.000Z"),
        },
      },
      {
        kind: "ALL_DAY",
        startsAt: {
          gte: new Date("2026-09-21T00:00:00.000Z"),
          lt: new Date("2026-09-28T00:00:00.000Z"),
        },
      },
    ]);
  });
});

describe("parseScheduleInput", () => {
  test("round-trips toScheduleInput", () => {
    const stored = toStoredSchedule("2026-09-28", "10:00", BUENOS_AIRES);
    expect(parseScheduleInput(toScheduleInput(stored))).toEqual(stored);
  });

  test("accepts an all-day schedule at 00:00 UTC", () => {
    expect(parseScheduleInput({ kind: "ALL_DAY", startsAt: "2026-09-28T00:00:00.000Z" })).toEqual({
      kind: "ALL_DAY",
      startsAt: new Date("2026-09-28T00:00:00.000Z"),
    });
  });

  test.each([
    ["an unknown kind", { kind: "WEEKLY", startsAt: "2026-09-28T13:00:00.000Z" }],
    ["a missing instant", { kind: "TIMED" }],
    ["an instant with an offset instead of Z", { kind: "TIMED", startsAt: "2026-09-28T10:00:00-03:00" }],
    ["an impossible date", { kind: "TIMED", startsAt: "2026-02-30T10:00:00.000Z" }],
    ["an all-day schedule not at 00:00 UTC", { kind: "ALL_DAY", startsAt: "2026-09-28T03:00:00.000Z" }],
    ["a non-object", "2026-09-28"],
    ["null", null],
  ])("rejects %s", (_, input) => {
    expect(() => parseScheduleInput(input)).toThrow("INVALID_SCHEDULE");
  });
});
