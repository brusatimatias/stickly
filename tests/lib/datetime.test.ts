import { describe, expect, test } from "vitest";
import { dateToDay, dayToDate, isValidDay, nextDay } from "@/lib/datetime";

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

describe("isValidDay", () => {
  test("accepts a real yyyy-MM-dd day", () => {
    expect(isValidDay("2026-02-28")).toBe(true);
    expect(isValidDay("2028-02-29")).toBe(true);
  });

  test.each(["2026-02-30", "2026-13-01", "2026-2-3", "26-02-03", "", "2026-02-03T00:00"])(
    "rejects %j",
    (day) => {
      expect(isValidDay(day)).toBe(false);
    }
  );
});
