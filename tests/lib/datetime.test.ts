import { describe, expect, test } from "vitest";
import { dateToDay, dayToDate, localDateTime } from "@/lib/datetime";

describe("dayToDate / dateToDay", () => {
  test("maps a day to midnight UTC, as Prisma reads a DATE column", () => {
    expect(dayToDate("2026-09-26").toISOString()).toBe("2026-09-26T00:00:00.000Z");
  });

  test("round-trips a day", () => {
    expect(dateToDay(dayToDate("2026-12-31"))).toBe("2026-12-31");
  });
});

describe("localDateTime", () => {
  test("joins a day and a time as a zone-less wall-clock string", () => {
    expect(localDateTime("2026-09-26", "22:00")).toBe("2026-09-26T22:00:00");
  });

  test("adds minutes, rolling over to the next day", () => {
    expect(localDateTime("2026-09-26", "23:30", 60)).toBe("2026-09-27T00:30:00");
  });

  test("rolls over month and year boundaries", () => {
    expect(localDateTime("2026-12-31", "23:15", 60)).toBe("2027-01-01T00:15:00");
  });
});
