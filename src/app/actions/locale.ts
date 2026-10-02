"use server";

import { LOCALE_COOKIE_NAME, isSupportedLocale, type Locale } from "@/i18n/locales";
import { setPreferenceCookie } from "@/lib/preferenceCookie";

export async function setLocale(locale: Locale) {
  if (!isSupportedLocale(locale)) {
    throw new Error("INVALID_LOCALE");
  }
  await setPreferenceCookie(LOCALE_COOKIE_NAME, locale);
}
