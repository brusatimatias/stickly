"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteNote } from "@/app/actions/notes";
import NoteForm from "@/components/board/NoteForm";
import type { NoteDTO } from "@/components/board/types";

export default function NoteCard({ day, note }: { day: string; note: NoteDTO }) {
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
      <NoteForm day={day} note={note} onDone={() => setIsEditing(false)} />
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
      className="flex flex-col gap-1 rounded-md border border-amber-300 bg-amber-100 p-2 text-sm shadow-sm dark:border-amber-800 dark:bg-amber-950"
    >
      <div className="flex items-start justify-between gap-1">
        <button
          type="button"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
          className="cursor-grab select-none text-zinc-500 active:cursor-grabbing"
        >
          ⠿
        </button>
        <div className="flex-1">
          <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
            {note.time}
          </p>
          <p className="font-medium text-zinc-900 dark:text-zinc-100">
            {note.title}
          </p>
          {note.location && (
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              {note.location}
            </p>
          )}
        </div>
      </div>
      <div className="flex gap-2 text-xs">
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="text-red-700 underline hover:text-red-900 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
