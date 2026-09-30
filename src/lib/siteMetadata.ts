import type { Theme } from "@/lib/theme";

const LOCAL_URL = "http://localhost:3000";

function withProtocol(host: string): string {
  return /^https?:\/\//.test(host) ? host : `https://${host}`;
}

/**
 * The app's public URL, which absolute metadata URLs (Open Graph image,
 * etc.) are built on. `SITE_URL` wins when set (e.g. a custom domain);
 * otherwise Vercel's production domain, which comes without a protocol.
 * A value without a protocol gets https (a bad URL here would make every
 * page fail, since the root layout's metadata uses it).
 */
export function getSiteUrl(env: Record<string, string | undefined> = process.env): URL {
  const configured = env.SITE_URL || env.VERCEL_PROJECT_PRODUCTION_URL;
  if (configured) {
    try {
      return new URL(withProtocol(configured.trim()));
    } catch {
      console.error("Invalid SITE_URL/VERCEL_PROJECT_PRODUCTION_URL, using localhost:", configured);
    }
  }
  return new URL(LOCAL_URL);
}

/** `--background` in globals.css for each theme; keep them in sync. */
export const THEME_BACKGROUNDS: Record<Theme, string> = {
  light: "#ffffff",
  dark: "#0a0a0a",
};

/**
 * The browser UI color: the base background (`--background`, behind the
 * headers) of the theme chosen in the cookie, or, with no choice, the one
 * matching the OS preference.
 */
export function getThemeColor(theme: Theme | null) {
  if (theme) return THEME_BACKGROUNDS[theme];
  return [
    { media: "(prefers-color-scheme: light)", color: THEME_BACKGROUNDS.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_BACKGROUNDS.dark },
  ];
}
