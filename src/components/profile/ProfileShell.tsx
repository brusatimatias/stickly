import { useTranslations } from "next-intl";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeftIcon } from "@/components/icons";
import { FOCUS_RING } from "@/components/focusRing";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import PageHeader from "@/components/PageHeader";
import ThemeToggle from "@/components/ThemeToggle";

/** The profile's header and background, shared by the page and its loading skeleton. */
export default function ProfileShell({ children }: { children: ReactNode }) {
  const t = useTranslations("profile");

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader>
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
      </PageHeader>
      <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10 dark:bg-black">{children}</div>
    </div>
  );
}
