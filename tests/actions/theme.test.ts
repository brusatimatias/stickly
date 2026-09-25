import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Theme } from "@/lib/theme";

const mockCookieSet = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: async () => ({ set: mockCookieSet }),
}));

import { setTheme } from "@/app/actions/theme";

beforeEach(() => {
  mockCookieSet.mockReset();
});

describe("setTheme", () => {
  test("stores the theme in a year-long cookie", async () => {
    await setTheme("dark");
    expect(mockCookieSet).toHaveBeenCalledWith("THEME", "dark", {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  });

  test("rejects an unsupported theme", async () => {
    await expect(setTheme("system" as Theme)).rejects.toThrow("INVALID_THEME");
    expect(mockCookieSet).not.toHaveBeenCalled();
  });
});
