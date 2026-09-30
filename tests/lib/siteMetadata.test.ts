import { describe, expect, test, vi } from "vitest";
import { getSiteUrl, getThemeColor } from "@/lib/siteMetadata";

describe("getSiteUrl", () => {
  test("prefers SITE_URL", () => {
    const url = getSiteUrl({ SITE_URL: "https://stickly.example", VERCEL_PROJECT_PRODUCTION_URL: "stickly.vercel.app" });
    expect(url.href).toBe("https://stickly.example/");
  });

  test("falls back to Vercel's production domain, adding the protocol", () => {
    expect(getSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "stickly.vercel.app" }).href).toBe(
      "https://stickly.vercel.app/"
    );
  });

  test("adds https to a SITE_URL without a protocol", () => {
    expect(getSiteUrl({ SITE_URL: "stickly.example" }).href).toBe("https://stickly.example/");
  });

  test("falls back to localhost instead of throwing on an invalid value", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(getSiteUrl({ SITE_URL: "not a url" }).href).toBe("http://localhost:3000/");
  });

  test("uses localhost when neither is set", () => {
    expect(getSiteUrl({}).href).toBe("http://localhost:3000/");
  });
});

describe("getThemeColor", () => {
  test("uses the chosen theme's background", () => {
    expect(getThemeColor("dark")).toBe("#0a0a0a");
    expect(getThemeColor("light")).toBe("#ffffff");
  });

  test("follows the OS preference when no theme was chosen", () => {
    expect(getThemeColor(null)).toEqual([
      { media: "(prefers-color-scheme: light)", color: "#ffffff" },
      { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
    ]);
  });
});
