"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocale } from "@/app/actions/locale";
import { SUPPORTED_LOCALES, type Locale } from "@/i18n/locales";

export default function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleChange(next: Locale) {
    if (next === locale || isPending) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center overflow-hidden rounded-full border border-zinc-300 text-xs font-medium dark:border-zinc-700">
      {SUPPORTED_LOCALES.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => handleChange(option)}
          disabled={isPending}
          className={`px-2.5 py-1 uppercase transition-colors ${
            option === locale
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
