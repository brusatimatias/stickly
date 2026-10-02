import Link from "next/link";
import { useTranslations } from "next-intl";
import FoldedCorner from "@/components/board/FoldedCorner";
import { ChevronLeftIcon } from "@/components/icons";
import { FOCUS_RING } from "@/components/focusRing";

/** 404 for unknown URLs and `notFound()`: a note that fell off the board. */
export default function NotFound() {
  const t = useTranslations("notFound");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 bg-zinc-50 px-6 py-16 dark:bg-black">
      <div className="relative flex h-60 w-60 rotate-3 flex-col gap-3 overflow-hidden rounded-sm border border-yellow-300 bg-yellow-200 p-5 text-yellow-950 shadow-[2px_4px_6px_rgba(0,0,0,0.3)] sm:h-64 sm:w-64 dark:shadow-[2px_4px_6px_rgba(0,0,0,0.6)]">
        <FoldedCorner />
        <p aria-hidden className="text-5xl font-bold tracking-tight opacity-80">
          404
        </p>
        <h1 className="text-lg leading-snug font-semibold">{t("title")}</h1>
        <p className="text-sm leading-snug opacity-80">{t("message")}</p>
      </div>
      <Link
        href="/"
        className={`flex items-center gap-1.5 rounded-full bg-zinc-900 py-2 pr-4 pl-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white ${FOCUS_RING}`}
      >
        <ChevronLeftIcon className="h-4 w-4" />
        {t("backToBoard")}
      </Link>
    </main>
  );
}
