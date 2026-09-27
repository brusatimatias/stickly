import { describe, expect, test } from "vitest";
import { getTodayInZone, isValidTimeZone, resolveTimeZone } from "@/lib/timezone";

describe("isValidTimeZone", () => {
  test("accepts IANA zones", () => {
    expect(isValidTimeZone("America/Argentina/Buenos_Aires")).toBe(true);
    expect(isValidTimeZone("Europe/Madrid")).toBe(true);
  });

  test("rejects unknown zones, empty values and non-strings", () => {
    expect(isValidTimeZone("Mars/Olympus_Mons")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone(null)).toBe(false);
    expect(isValidTimeZone(42)).toBe(false);
  });

  test("rejects overly long values", () => {
    expect(isValidTimeZone("A".repeat(65))).toBe(false);
  });
});

describe("resolveTimeZone", () => {
  test("returns the first valid candidate", () => {
    expect(resolveTimeZone(null, "bogus", "Europe/Madrid", "UTC")).toBe("Europe/Madrid");
  });

  test("falls back to UTC when none is valid", () => {
    expect(resolveTimeZone(undefined, "bogus")).toBe("UTC");
  });
});

describe("getTodayInZone", () => {
  // Saturday 22:30 in Buenos Aires (UTC-3) is already Sunday in UTC: the bug
  // where the production board highlighted the next day.
  const now = new Date("2026-09-27T01:30:00Z");

  test("uses the given zone, not UTC", () => {
    expect(getTodayInZone("America/Argentina/Buenos_Aires", now)).toBe("2026-09-26");
    expect(getTodayInZone("UTC", now)).toBe("2026-09-27");
  });

  test("works for zones ahead of UTC", () => {
    expect(getTodayInZone("Asia/Tokyo", new Date("2026-09-26T16:00:00Z"))).toBe("2026-09-27");
  });
});
