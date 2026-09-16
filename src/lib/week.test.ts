import { describe, expect, test } from "vitest";
import {
  formatWeekParam,
  getAdjacentWeekStart,
  getWeekRange,
  parseWeekParam,
} from "./week";

describe("getWeekRange", () => {
  test("returns Monday start and next Monday as exclusive end", () => {
    // Wednesday, September 16, 2026
    const { start, end } = getWeekRange(new Date(2026, 8, 16, 14, 30));

    expect(start).toEqual(new Date(2026, 8, 14));
    expect(end).toEqual(new Date(2026, 8, 21));
  });

  test("a Sunday belongs to the week that started the previous Monday", () => {
    const { start, end } = getWeekRange(new Date(2026, 8, 20, 9, 0));

    expect(start).toEqual(new Date(2026, 8, 14));
    expect(end).toEqual(new Date(2026, 8, 21));
  });
});

describe("formatWeekParam", () => {
  test("formats the Monday of the reference date's week", () => {
    expect(formatWeekParam(new Date(2026, 8, 16))).toBe("2026-09-14");
  });
});

describe("parseWeekParam", () => {
  test("parses a valid yyyy-MM-dd string", () => {
    const parsed = parseWeekParam("2026-09-14");
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(8);
    expect(parsed.getDate()).toBe(14);
  });

  test("falls back to now for missing input", () => {
    const before = Date.now();
    const parsed = parseWeekParam(undefined);
    const after = Date.now();
    expect(parsed.getTime()).toBeGreaterThanOrEqual(before);
    expect(parsed.getTime()).toBeLessThanOrEqual(after);
  });

  test("falls back to now for invalid input", () => {
    const before = Date.now();
    const parsed = parseWeekParam("not-a-date");
    const after = Date.now();
    expect(parsed.getTime()).toBeGreaterThanOrEqual(before);
    expect(parsed.getTime()).toBeLessThanOrEqual(after);
  });
});

describe("getAdjacentWeekStart", () => {
  test("moves to the previous week's Monday", () => {
    const start = new Date(2026, 8, 14);
    expect(getAdjacentWeekStart(start, "prev")).toEqual(new Date(2026, 8, 7));
  });

  test("moves to the next week's Monday", () => {
    const start = new Date(2026, 8, 14);
    expect(getAdjacentWeekStart(start, "next")).toEqual(new Date(2026, 8, 21));
  });
});
