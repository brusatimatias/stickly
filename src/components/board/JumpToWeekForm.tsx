"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function JumpToWeekForm({
  currentWeekParam,
}: {
  currentWeekParam: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(currentWeekParam);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    router.push(`/?week=${value}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        type="date"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <button
        type="submit"
        className="rounded-full border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        Go to week
      </button>
    </form>
  );
}
