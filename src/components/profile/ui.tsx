import { CheckIcon } from "@/components/profile/icons";

const BUTTON_BASE =
  "cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

/** The main action of a section (save). */
export const PRIMARY_BUTTON = `${BUTTON_BASE} bg-zinc-900 text-white hover:bg-zinc-700 focus-visible:outline-zinc-400 disabled:hover:bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:disabled:hover:bg-zinc-100`;

export const SECONDARY_BUTTON = `${BUTTON_BASE} border border-zinc-300 text-zinc-700 hover:bg-zinc-100 focus-visible:outline-zinc-400 disabled:hover:bg-transparent dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900`;

/** Undoing something (unlink): red text, confirmed in a dialog. */
export const DANGER_BUTTON = `${BUTTON_BASE} border border-red-200 text-red-600 hover:bg-red-50 focus-visible:outline-red-400 disabled:hover:bg-transparent dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950`;

export const INPUT_CLASS =
  "w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-amber-500 dark:border-zinc-700 dark:bg-zinc-900";

export const LABEL_CLASS = "text-sm font-medium text-zinc-700 dark:text-zinc-300";

export const HINT_CLASS = "text-xs text-zinc-500 dark:text-zinc-400";

/** A white panel holding one or more sections, separated by lines. */
export const CARD_CLASS =
  "flex w-full flex-col divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white p-8 shadow-xl dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950";

/** A titled section inside a card: spaced from the ones around it, flush with the card's edges. */
export const SECTION_CLASS = "flex flex-col gap-2 pt-6 first:pt-0 not-last:pb-6";

export type Status = { type: "success" | "error"; text: string } | null;

/** A section's result: green with a check when it worked, red when it didn't. Announced to screen readers. */
export function StatusMessage({ status }: { status: Status }) {
  return (
    <p role="status" aria-live="polite" className="min-h-4 text-xs">
      {status?.type === "success" && (
        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
          <CheckIcon className="h-3.5 w-3.5" />
          {status.text}
        </span>
      )}
      {status?.type === "error" && <span className="text-red-500 dark:text-red-400">{status.text}</span>}
    </p>
  );
}
