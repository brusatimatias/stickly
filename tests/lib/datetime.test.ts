import { describe, expect, test } from "vitest";
import { dateToDay, dayToDate, nextDay } from "@/lib/datetime";

describe("dayToDate / dateToDay", () => {
  test("maps a day to midnight UTC, as Prisma reads a DATE column", () => {
    expect(dayToDate("2026-09-26").toISOString()).toBe("2026-09-26T00:00:00.000Z");
  });

  test("round-trips a day", () => {
    expect(dateToDay(dayToDate("2026-12-31"))).toBe("2026-12-31");
  });
});

describe("nextDay", () => {
  test("steps to the next day across month and year boundaries", () => {
    expect(nextDay("2026-09-26")).toBe("2026-09-27");
    expect(nextDay("2026-12-31")).toBe("2027-01-01");
  });
});
