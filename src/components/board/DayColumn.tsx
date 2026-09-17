"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { useState } from "react";
import NoteCard from "@/components/board/NoteCard";
import NoteForm from "@/components/board/NoteForm";
import type { BoardDay, NoteDTO } from "@/components/board/types";
import { PlusIcon } from "@/components/board/icons";

export default function DayColumn({
  day,
  notes,
}: {
  day: BoardDay;
  notes: NoteDTO[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: day.key });
  const [isAdding, setIsAdding] = useState(false);

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[16rem] w-full flex-col gap-3 rounded-lg border border-dashed p-2 transition-colors ${
        isOver
          ? "border-amber-400 bg-amber-50/60 dark:border-amber-700 dark:bg-amber-950/20"
          : "border-transparent"
      }`}
    >
      <header className="grid grid-cols-[1.25rem_1fr_1.25rem] items-center">
        <span aria-hidden />
        <p className="text-center text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          {day.label}
        </p>
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          aria-label="Add note"
          className="justify-self-end rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:text-zinc-600 dark:hover:bg-zinc-900 dark:hover:text-zinc-300"
        >
          <PlusIcon className="h-3.5 w-3.5" />
        </button>
      </header>

      <SortableContext id={day.key} items={notes.map((note) => note.id)} strategy={rectSortingStrategy}>
        <div className="flex flex-1 flex-wrap items-start gap-2">
          {notes.length === 0 && !isAdding && (
            <p className="text-xs text-zinc-400 dark:text-zinc-600">No notes yet</p>
          )}
          {notes.map((note) => (
            <NoteCard key={note.id} day={day.key} note={note} />
          ))}
          {isAdding && <NoteForm day={day.key} onDone={() => setIsAdding(false)} />}
        </div>
      </SortableContext>
    </div>
  );
}
