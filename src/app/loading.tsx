import { useTranslations } from "next-intl";
import PageHeader from "@/components/PageHeader";

// No radius here: each block sets its own, since two radius classes on one
// element don't combine predictably.
const BLOCK = "bg-zinc-200/70 dark:bg-zinc-800/70";

// A few days get a card or two so the skeleton reads as "notes on a week".
const CARDS_PER_DAY = [1, 2, 0, 1, 0, 1, 0];

/** Skeleton of the board (header, week nav, drafts and the week) while it loads. */
export default function Loading() {
  const t = useTranslations("board");

  return (
    <div role="status" className="flex flex-1 flex-col motion-safe:animate-pulse">
      <span className="sr-only">{t("loadingBoard")}</span>
      <div aria-hidden className="flex flex-1 flex-col">
        <PageHeader>
          <div className={`rounded-md h-6 w-20 ${BLOCK}`} />
          <div className="flex items-center gap-2 sm:gap-3">
            <div className={`h-8 w-8 rounded-full ${BLOCK}`} />
            <div className={`h-7 w-7 rounded-full ${BLOCK}`} />
            <div className={`h-6 w-16 rounded-full ${BLOCK}`} />
            <div className={`h-8 w-24 rounded-full ${BLOCK}`} />
          </div>
        </PageHeader>
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className={`h-7 w-7 rounded-full ${BLOCK}`} />
          <div className={`h-8 w-48 rounded-full ${BLOCK}`} />
          <div className={`h-7 w-7 rounded-full ${BLOCK}`} />
        </div>
        <div className="flex flex-col gap-3 p-4 lg:flex-row">
          <div className="flex h-40 w-full flex-col gap-3 rounded-lg border border-dashed border-zinc-200 p-3 lg:h-auto lg:w-44 dark:border-zinc-800">
            <div className={`rounded-md mx-auto h-4 w-16 ${BLOCK}`} />
          </div>
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
            {CARDS_PER_DAY.map((cards, day) => (
              <div key={day} className="flex min-h-[16rem] flex-col items-center gap-3 p-2">
                <div className={`rounded-md h-4 w-14 ${BLOCK}`} />
                {Array.from({ length: cards }, (_, card) => (
                  <div key={card} className={`aspect-square w-full max-w-44 rounded-sm sm:max-w-48 ${BLOCK}`} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
