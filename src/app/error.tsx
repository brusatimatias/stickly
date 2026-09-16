"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Something went wrong.
      </h2>
      <p className="max-w-md text-sm text-zinc-600 dark:text-zinc-400">
        {error.message || "An unexpected error occurred while loading your board."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background hover:bg-[#383838] dark:hover:bg-[#ccc]"
      >
        Try again
      </button>
    </div>
  );
}
