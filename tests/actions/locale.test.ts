import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Locale } from "@/i18n/locales";

const mockCookieSet = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: async () => ({ set: mockCookieSet }),
}));

import { setLocale } from "@/app/actions/locale";

beforeEach(() => {
  mockCookieSet.mockReset();
});

describe("setLocale", () => {
  test("stores the locale in a year-long cookie", async () => {
    await setLocale("es");
    expect(mockCookieSet).toHaveBeenCalledWith("NEXT_LOCALE", "es", {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  });

  test("rejects an unsupported locale", async () => {
    await expect(setLocale("fr" as Locale)).rejects.toThrow("INVALID_LOCALE");
    expect(mockCookieSet).not.toHaveBeenCalled();
  });
});
