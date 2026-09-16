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
      <header className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
        Draft
      </header>

      <SortableContext
        id="draft"
        items={note ? [note.id] : []}
        strategy={rectSortingStrategy}
      >
        {note && <DraftCard note={note} />}
      </SortableContext>

      {!note &&
        (isCreating ? (
          <DraftForm onDone={() => setIsCreating(false)} />
        ) : (
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            aria-label="New draft note"
            className="flex h-44 w-44 items-center justify-center rounded-sm border border-dashed border-zinc-300 text-2xl text-zinc-400 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900 sm:h-48 sm:w-48"
          >
            +
          </button>
        ))}
    </div>
  );
}
