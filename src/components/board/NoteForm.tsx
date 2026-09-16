"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { createNote, updateNote } from "@/app/actions/notes";
import type { NoteDTO } from "@/components/board/types";

export default function NoteForm({
  day,
  note,
  onDone,
}: {
  day: string;
  note?: NoteDTO;
  onDone: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(note?.title ?? "");
  const [location, setLocation] = useState(note?.location ?? "");
  const [time, setTime] = useState(note?.time ?? "09:00");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      if (note) {
        await updateNote({ id: note.id, title, location, time });
      } else {
        await createNote({ title, location, day, time });
      }
      router.refresh();
      onDone();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-md border border-zinc-300 bg-white p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
    >
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Title"
        aria-label="Title"
        required
        className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
      />
      <input
        value={location}
        onChange={(event) => setLocation(event.target.value)}
        placeholder="Location (optional)"
        aria-label="Location"
        className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
      />
      <input
        type="time"
        value={time}
        onChange={(event) => setTime(event.target.value)}
        aria-label="Time"
        className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-foreground px-2 py-1 text-background disabled:opacity-50"
        >
          Save
        </button>
        <button type="button" onClick={onDone} className="rounded px-2 py-1">
          Cancel
        </button>
      </div>
    </form>
  );
}
