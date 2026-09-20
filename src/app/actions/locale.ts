"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE_NAME, SUPPORTED_LOCALES, type Locale } from "@/i18n/locales";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function setLocale(locale: Locale) {
  if (!SUPPORTED_LOCALES.includes(locale)) {
    throw new Error("INVALID_LOCALE");
  }
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE_NAME, locale, {
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });
}
