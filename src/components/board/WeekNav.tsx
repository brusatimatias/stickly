"use client";

import { format, parseISO } from "date-fns";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { useRouter } from "next/navigation";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "@/components/board/icons";

export default function WeekNav({
  weekLabel,
  prevWeekParam,
  nextWeekParam,
  currentWeekParam,
  todayWeekParam,
}: {
  weekLabel: string;
  prevWeekParam: string;
  nextWeekParam: string;
  currentWeekParam: string;
  todayWeekParam: string;
}) {
  const t = useTranslations("board");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const isoWeekValue = format(parseISO(currentWeekParam), "RRRR-'W'II");
  const isCurrentWeek = currentWeekParam === todayWeekParam;

  function handleWeekPick(value: string) {
    if (!value) return;
    router.push(`/?week=${value}`);
  }

  function openPicker() {
    inputRef.current?.showPicker?.();
  }

  return (
    <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <Link
        href={`/?week=${prevWeekParam}`}
        aria-label={t("previousWeek")}
        className="rounded-full bg-zinc-900 p-1.5 text-white shadow-sm hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        <ChevronLeftIcon className="h-4 w-4" />
      </Link>

      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            type="button"
            onClick={openPicker}
            className="flex cursor-pointer items-center gap-1.5 rounded-full bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            <CalendarIcon className="h-4 w-4 opacity-80" />
            {weekLabel}
          </button>
          <input
            ref={inputRef}
            type="week"
            value={isoWeekValue}
            onChange={(event) => handleWeekPick(event.target.value)}
            aria-label={t("jumpToWeek")}
            tabIndex={-1}
            className="pointer-events-none absolute inset-0 opacity-0"
          />
        </div>
        {isCurrentWeek ? (
          <span className="rounded-full bg-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500">
            {t("today")}
          </span>
        ) : (
          <Link
            href={`/?week=${todayWeekParam}`}
            className="rounded-full bg-amber-500 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-amber-600"
          >
            {t("today")}
          </Link>
        )}
      </div>

      <Link
        href={`/?week=${nextWeekParam}`}
        aria-label={t("nextWeek")}
        className="rounded-full bg-zinc-900 p-1.5 text-white shadow-sm hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        <ChevronRightIcon className="h-4 w-4" />
      </Link>
    </div>
  );
}
