"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setTheme } from "@/app/actions/theme";
import { MoonIcon, SunIcon } from "@/components/board/icons";
import { THEMES, getNextTheme, type Theme } from "@/lib/theme";

function readCurrentTheme(): Theme | null {
  const classList = document.documentElement.classList;
  return THEMES.find((theme) => classList.contains(theme)) ?? null;
}

export default function ThemeToggle() {
  const t = useTranslations("common");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    if (isPending) return;
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const next = getNextTheme(readCurrentTheme(), systemPrefersDark);

    // Apply immediately so the switch feels instant; the cookie makes the
    // server render the same class on the next request.
    const classList = document.documentElement.classList;
    classList.remove(...THEMES);
    classList.add(next);

    startTransition(async () => {
      await setTheme(next);
      router.refresh();
    });
  }

  // Both icons are rendered and CSS picks one, so the server-rendered markup
  // is correct even when the theme comes from the OS preference.
  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isPending}
      className="rounded-full border border-zinc-300 p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
    >
      <MoonIcon className="h-3.5 w-3.5 dark:hidden" />
      <span className="sr-only dark:hidden">{t("switchToDark")}</span>
      <SunIcon className="hidden h-3.5 w-3.5 dark:block" />
      <span className="sr-only hidden dark:inline">{t("switchToLight")}</span>
    </button>
  );
}
