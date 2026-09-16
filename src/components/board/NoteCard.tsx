"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addNoteToGoogleCalendar } from "@/app/actions/calendar";
import { deleteNote } from "@/app/actions/notes";
import { getNoteStyle } from "@/lib/noteColor";
import FoldedCorner from "@/components/board/FoldedCorner";
import NoteForm from "@/components/board/NoteForm";
import type { NoteDTO } from "@/components/board/types";

export default function NoteCard({ day, note }: { day: string; note: NoteDTO }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isSyncing, startSyncTransition] = useTransition();
  const [syncError, setSyncError] = useState<string | null>(null);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: note.id });
  const noteStyle = getNoteStyle(note.id);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (isEditing) {
    return (
      <div className="w-36 sm:w-40">
        <NoteForm day={day} note={note} onDone={() => setIsEditing(false)} />
      </div>
    );
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteNote(note.id);
      router.refresh();
    });
  }

  function handleSyncToCalendar() {
    setSyncError(null);
    startSyncTransition(async () => {
      try {
        await addNoteToGoogleCalendar(note.id);
        router.refresh();
      } catch (error) {
        setSyncError(error instanceof Error ? error.message : "Failed to sync.");
      }
    });
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => setIsEditing(true)}
      className={`group relative flex h-36 w-36 cursor-pointer flex-col justify-between overflow-hidden rounded-sm border p-2 text-sm shadow-md transition-transform hover:z-10 hover:scale-105 hover:shadow-lg sm:h-40 sm:w-40 ${noteStyle.rotation} ${noteStyle.bg} ${noteStyle.border} ${noteStyle.text}`}
    >
      <FoldedCorner />
      <button
        type="button"
        aria-label="Drag to reorder"
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
        <p className="text-xs font-medium opacity-80">{note.time}</p>
        <p className="line-clamp-3 font-semibold">{note.title}</p>
        {note.location && (
          <p className="line-clamp-1 text-xs opacity-70">{note.location}</p>
        )}
      </div>

      <button
        type="button"
        aria-label={note.googleEventId ? "Update in Calendar" : "Add to Calendar"}
        onClick={(event) => {
          event.stopPropagation();
          handleSyncToCalendar();
        }}
        disabled={isSyncing}
        className="self-end text-xs opacity-0 underline transition-opacity group-hover:opacity-70 disabled:opacity-30"
      >
        {isSyncing ? "…" : note.googleEventId ? "↻ Calendar" : "+ Calendar"}
      </button>

      {syncError && (
        <p className="absolute inset-x-1 bottom-1 truncate text-[10px] text-red-700">
          {syncError}
        </p>
      )}
    </div>
  );
}
