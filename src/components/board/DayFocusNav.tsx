"use client";

import { useTranslations } from "next-intl";
import { ChevronLeftIcon, ChevronRightIcon, GridIcon } from "@/components/board/icons";
import type { BoardDay } from "@/components/board/types";

export default function DayFocusNav({
  days,
  focusedDay,
  todayKey,
  onSelect,
  onExit,
}: {
  days: BoardDay[];
  focusedDay: string;
  todayKey: string;
  onSelect: (day: string) => void;
  onExit: () => void;
}) {
  const t = useTranslations("board");
  const index = days.findIndex((day) => day.key === focusedDay);

  function step(delta: number) {
    const next = days[index + delta];
    if (next) onSelect(next.key);
  }

  return (
    <div className="mb-3 flex items-center gap-2">
      <button
        type="button"
        onClick={onExit}
        aria-label={t("backToWeek")}
        className="flex shrink-0 items-center gap-1.5 rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        <GridIcon className="h-3.5 w-3.5" />
        {t("backToWeek")}
      </button>

      <button
        type="button"
        onClick={() => step(-1)}
        disabled={index <= 0}
        aria-label={t("previousDay")}
        className="shrink-0 rounded-full bg-zinc-900 p-1.5 text-white shadow-sm hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white dark:disabled:hover:bg-zinc-100"
      >
        <ChevronLeftIcon className="h-4 w-4" />
      </button>

      <div className="grid flex-1 auto-cols-fr grid-flow-col gap-1">
        {days.map((day) => {
          const isActive = day.key === focusedDay;
          const isToday = day.key === todayKey;
          return (
            <button
              key={day.key}
              type="button"
              onClick={() => onSelect(day.key)}
              aria-current={isActive ? "true" : undefined}
              className={`rounded-full px-2 py-1.5 text-center text-xs font-medium transition-colors ${
                isActive
                  ? "bg-amber-500 text-white shadow-sm"
                  : isToday
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              {day.label}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => step(1)}
        disabled={index >= days.length - 1}
        aria-label={t("nextDay")}
        className="shrink-0 rounded-full bg-zinc-900 p-1.5 text-white shadow-sm hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white dark:disabled:hover:bg-zinc-100"
      >
        <ChevronRightIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
