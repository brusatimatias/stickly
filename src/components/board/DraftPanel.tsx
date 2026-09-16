"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
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
      className="flex w-full flex-col gap-2 rounded-md border border-sky-200 bg-sky-50 p-3 dark:border-sky-900 dark:bg-sky-950/40 lg:w-64"
    >
      <header className="text-sm font-semibold text-sky-900 dark:text-sky-200">
        Draft note
      </header>

      <SortableContext
        id="draft"
        items={note ? [note.id] : []}
        strategy={verticalListSortingStrategy}
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
            className="rounded-md border border-dashed border-sky-300 py-1 text-xs text-sky-700 hover:bg-sky-100 dark:border-sky-800 dark:hover:bg-sky-900"
          >
            + New draft note
          </button>
        ))}
    </div>
  );
}
