import Link from "next/link";
import JumpToWeekForm from "@/components/board/JumpToWeekForm";

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
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <div className="flex items-center gap-3">
        <Link
          href={`/?week=${prevWeekParam}`}
          className="rounded-full border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          ← Previous
        </Link>
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {weekLabel}
        </span>
        <Link
          href={`/?week=${nextWeekParam}`}
          className="rounded-full border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Next →
        </Link>
      </div>
      <JumpToWeekForm currentWeekParam={currentWeekParam} />
    </div>
  );
}
