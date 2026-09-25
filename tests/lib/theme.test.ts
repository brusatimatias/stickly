import { describe, expect, test } from "vitest";
import { getNextTheme, isTheme } from "@/lib/theme";

describe("isTheme", () => {
  test("accepts the supported themes", () => {
    expect(isTheme("light")).toBe(true);
    expect(isTheme("dark")).toBe(true);
  });

  test("rejects anything else", () => {
    expect(isTheme(undefined)).toBe(false);
    expect(isTheme("")).toBe(false);
    expect(isTheme("system")).toBe(false);
  });
});

describe("getNextTheme", () => {
  test("flips an explicit choice regardless of the OS preference", () => {
    expect(getNextTheme("light", true)).toBe("dark");
    expect(getNextTheme("dark", false)).toBe("light");
  });

  test("flips the OS preference when there's no explicit choice", () => {
    expect(getNextTheme(null, true)).toBe("light");
    expect(getNextTheme(null, false)).toBe("dark");
  });
});
