import { describe, expect, test } from "vitest";
import { combineDayAndTime } from "./datetime";

describe("combineDayAndTime", () => {
  test("combines a day and a time into a single Date", () => {
    const result = combineDayAndTime("2026-09-16", "14:30");
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(8);
    expect(result.getDate()).toBe(16);
    expect(result.getHours()).toBe(14);
    expect(result.getMinutes()).toBe(30);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  test("defaults to midnight when the time is empty", () => {
    const result = combineDayAndTime("2026-09-16", "");
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
  });
});
