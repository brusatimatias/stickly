"use client";

import { format, parseISO } from "date-fns";
import Link from "next/link";
import { useRef } from "react";
import { useRouter } from "next/navigation";

export default function WeekNav({
  weekLabel,
  prevWeekParam,
  nextWeekParam,
  currentWeekParam,
}: {
  weekLabel: string;
  prevWeekParam: string;
  nextWeekParam: string;
  currentWeekParam: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const isoWeekValue = format(parseISO(currentWeekParam), "RRRR-'W'II");

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
        aria-label="Previous week"
        className="rounded-full border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        ←
      </Link>

      <div className="relative">
        <button
          type="button"
          onClick={openPicker}
          className="text-sm font-medium text-zinc-700 hover:underline dark:text-zinc-300"
        >
          {weekLabel}
        </button>
        <input
          ref={inputRef}
          type="week"
          value={isoWeekValue}
          onChange={(event) => handleWeekPick(event.target.value)}
          aria-label="Jump to week"
          tabIndex={-1}
          className="pointer-events-none absolute inset-0 opacity-0"
        />
      </div>

      <Link
        href={`/?week=${nextWeekParam}`}
        aria-label="Next week"
        className="rounded-full border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        →
      </Link>
    </div>
  );
}
