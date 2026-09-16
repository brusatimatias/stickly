"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteNote } from "@/app/actions/notes";
import DraftForm from "@/components/board/DraftForm";
import FoldedCorner from "@/components/board/FoldedCorner";
import type { NoteDTO } from "@/components/board/types";

export default function DraftCard({ note }: { note: NoteDTO }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: note.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (isEditing) {
    return (
      <div className="w-36 sm:w-40">
        <DraftForm note={note} onDone={() => setIsEditing(false)} />
      </div>
    );
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteNote(note.id);
      router.refresh();
    });
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => setIsEditing(true)}
      className="group relative flex h-36 w-36 -rotate-1 cursor-pointer flex-col justify-between overflow-hidden rounded-sm border border-orange-300 bg-orange-200 p-2 text-sm text-orange-950 shadow-md transition-transform hover:z-10 hover:scale-105 hover:shadow-lg sm:h-40 sm:w-40"
    >
      <FoldedCorner />
      <button
        type="button"
        aria-label="Drag to schedule"
        onClick={(event) => event.stopPropagation()}
        {...attributes}
        {...listeners}
        className="absolute left-1 top-1 cursor-grab select-none opacity-0 transition-opacity group-hover:opacity-70 active:cursor-grabbing"
      >
        ⠿
      </button>
      <button
        type="button"
        aria-label="Delete note"
        onClick={(event) => {
          event.stopPropagation();
          handleDelete();
        }}
        disabled={isPending}
        className="absolute right-1 top-1 opacity-0 transition-opacity group-hover:opacity-70 disabled:opacity-30"
      >
        ✕
      </button>

      <div className="mt-4 min-w-0">
        <p className="line-clamp-3 font-semibold">{note.title}</p>
        {note.location && (
          <p className="line-clamp-1 text-xs opacity-70">{note.location}</p>
        )}
      </div>

      <p className="text-[10px] opacity-70">Drag to a day →</p>
    </div>
  );
}
