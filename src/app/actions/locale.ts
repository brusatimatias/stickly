"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE_NAME, isSupportedLocale, type Locale } from "@/i18n/locales";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function setLocale(locale: Locale) {
  if (!isSupportedLocale(locale)) {
    throw new Error("INVALID_LOCALE");
  }
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE_NAME, locale, {
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });
}
