"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useState } from "react";
import NoteCard from "@/components/board/NoteCard";
import NoteForm from "@/components/board/NoteForm";
import type { BoardDay, NoteDTO } from "@/components/board/types";

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
      className={`flex min-h-[16rem] w-full flex-col gap-2 rounded-md border p-2 transition-colors ${
        isOver
          ? "border-amber-400 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40"
          : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950"
      }`}
    >
      <header className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
        {day.label}
      </header>

      <SortableContext id={day.key} items={notes.map((note) => note.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2">
          {notes.length === 0 && (
            <p className="text-xs text-zinc-400 dark:text-zinc-600">No notes yet</p>
          )}
          {notes.map((note) => (
            <NoteCard key={note.id} day={day.key} note={note} />
          ))}
        </div>
      </SortableContext>

      {isAdding ? (
        <NoteForm day={day.key} onDone={() => setIsAdding(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="rounded-md border border-dashed border-zinc-300 py-1 text-xs text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          + Add note
        </button>
      )}
    </div>
  );
}
