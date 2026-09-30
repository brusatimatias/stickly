import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronLeftIcon } from "@/components/board/icons";
import { FOCUS_RING } from "@/components/focusRing";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import ThemeToggle from "@/components/ThemeToggle";

// No radius here: each block sets its own, since two radius classes on one
// element don't combine predictably.
const BLOCK = "bg-zinc-200/70 dark:bg-zinc-800/70";

/**
 * The profile's real header (so the way back works while it loads) over a
 * skeleton of the profile card, in the same container as `page.tsx`.
 */
export default function ProfileLoading() {
  const t = useTranslations("profile");

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <Link
          href="/"
          className={`flex items-center gap-1 rounded-full py-1.5 pr-3 pl-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50 ${FOCUS_RING}`}
        >
          <ChevronLeftIcon className="h-4 w-4" />
          {t("backToBoard")}
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LocaleSwitcher />
        </div>
      </header>
      <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10 dark:bg-black">
        <div
          role="status"
          className="flex h-fit w-full max-w-sm flex-col divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white p-8 shadow-xl motion-safe:animate-pulse dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <span className="sr-only">{t("loadingProfile")}</span>
          <div aria-hidden className="flex flex-col items-center gap-3 pb-6">
            <div className={`h-24 w-24 rounded-full ${BLOCK}`} />
            <div className={`h-8 w-32 rounded-full ${BLOCK}`} />
          </div>
          <div aria-hidden className="flex flex-col gap-2 py-6">
            <div className={`rounded-md h-4 w-16 ${BLOCK}`} />
            <div className="flex gap-2">
              <div className={`h-9 flex-1 rounded-lg ${BLOCK}`} />
              <div className={`h-9 w-20 rounded-full ${BLOCK}`} />
            </div>
          </div>
          <div aria-hidden className="flex flex-col gap-2 pt-6">
            <div className={`rounded-md h-4 w-32 ${BLOCK}`} />
            <div className={`rounded-md h-3 w-full ${BLOCK}`} />
            <div className={`rounded-md h-3 w-2/3 ${BLOCK}`} />
            <div className={`mt-1 h-8 w-40 rounded-full ${BLOCK}`} />
          </div>
        </div>
      </div>
    </div>
  );
}
