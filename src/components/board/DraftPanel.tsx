"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { useState } from "react";
import DraftCard from "@/components/board/DraftCard";
import DraftForm from "@/components/board/DraftForm";
import type { NoteDTO } from "@/components/board/types";

export default function DraftPanel({ note }: { note: NoteDTO | null }) {
  const { setNodeRef } = useDroppable({ id: "draft" });
  const [isCreating, setIsCreating] = useState(false);

  return (
    <div
      ref={setNodeRef}
      className="flex w-full flex-col gap-3 rounded-lg border border-dashed border-zinc-200 p-3 dark:border-zinc-800 lg:w-44"
    >
      <header className="grid grid-cols-[1.25rem_1fr_1.25rem] items-center">
        <span aria-hidden />
        <p className="text-center text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Draft
        </p>
        {!note ? (
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            aria-label="New draft note"
            className="justify-self-end text-base leading-none text-zinc-400 hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-300"
          >
            +
          </button>
        ) : (
          <span aria-hidden />
        )}
      </header>

      <SortableContext
        id="draft"
        items={note ? [note.id] : []}
        strategy={rectSortingStrategy}
      >
        {note && <DraftCard note={note} />}
      </SortableContext>

      {!note && isCreating && <DraftForm onDone={() => setIsCreating(false)} />}
    </div>
  );
}
