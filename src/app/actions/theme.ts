"use server";

import { cookies } from "next/headers";
import { THEME_COOKIE_NAME, isTheme, type Theme } from "@/lib/theme";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function setTheme(theme: Theme) {
  if (!isTheme(theme)) {
    throw new Error("INVALID_THEME");
  }
  const cookieStore = await cookies();
  cookieStore.set(THEME_COOKIE_NAME, theme, {
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });
}
