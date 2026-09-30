"use client";

import { useLocale, useTranslations } from "next-intl";
import { useOptimistic, useTransition } from "react";
import { setLocale } from "@/app/actions/locale";
import { FOCUS_RING } from "@/components/focusRing";
import type { Locale } from "@/i18n/locales";

/**
 * EN/ES switch. The cookie set by `setLocale` stays the source of truth:
 * setting a cookie in a Server Action already returns the re-rendered page
 * in the same response, so there's no `router.refresh()` (that was a second
 * full round trip). The knob moves right away and pulses until the
 * translated page arrives.
 */
export default function LocaleSwitcher() {
  const t = useTranslations("common");
  const locale = useLocale() as Locale;
  const [isPending, startTransition] = useTransition();
  const [shownLocale, setShownLocale] = useOptimistic(locale);
  const isSpanish = shownLocale === "es";

  function handleToggle() {
    if (isPending) return;
    const next: Locale = isSpanish ? "en" : "es";
    startTransition(async () => {
      setShownLocale(next);
      await setLocale(next);
    });
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isSpanish}
      aria-label={t("spanishLanguage")}
      aria-disabled={isPending}
      aria-busy={isPending}
      onClick={handleToggle}
      className={`relative grid cursor-pointer grid-cols-2 rounded-full border border-zinc-300 p-0.5 text-xs font-medium aria-disabled:cursor-wait dark:border-zinc-700 ${FOCUS_RING}`}
    >
      <span
        aria-hidden
        className={`absolute inset-y-0.5 left-0.5 w-[calc(50%-0.125rem)] rounded-full bg-zinc-900 motion-safe:transition-[translate] motion-safe:duration-200 dark:bg-zinc-100 ${isSpanish ? "translate-x-full" : ""} ${isPending ? "motion-safe:animate-pulse" : ""}`}
      />
      {(["en", "es"] as const).map((option) => (
        <span
          key={option}
          aria-hidden
          className={`relative px-2 py-0.5 uppercase transition-colors ${
            option === shownLocale
              ? "text-white dark:text-zinc-900"
              : "text-zinc-500 dark:text-zinc-400"
          }`}
        >
          {option}
        </span>
      ))}
    </button>
  );
}
