"use server";

import { setPreferenceCookie } from "@/lib/preferenceCookie";
import { THEME_COOKIE_NAME, isTheme, type Theme } from "@/lib/theme";

export async function setTheme(theme: Theme) {
  if (!isTheme(theme)) {
    throw new Error("INVALID_THEME");
  }
  await setPreferenceCookie(THEME_COOKIE_NAME, theme);
}
