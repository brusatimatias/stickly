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
import { CalendarCheckIcon, CalendarIcon, SpinnerIcon } from "@/components/board/icons";

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
    return <NoteForm day={day} note={note} onDone={() => setIsEditing(false)} />;
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
      className={`group relative flex h-44 w-44 cursor-pointer flex-col justify-between overflow-hidden rounded-sm border p-2 text-sm shadow-md transition-transform hover:z-10 hover:scale-105 hover:shadow-lg sm:h-48 sm:w-48 ${noteStyle.rotation} ${noteStyle.bg} ${noteStyle.border} ${noteStyle.text}`}
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
        <p className="flex items-center gap-1 text-xs font-medium opacity-80">
          <span aria-hidden>🕐</span>
          {note.time}
        </p>
        <p className="line-clamp-3 font-semibold">{note.title}</p>
      </div>

      <div className="flex items-end justify-between gap-1">
        {note.location ? (
          <p className="flex min-w-0 items-center gap-1 text-xs opacity-70">
            <span aria-hidden>📍</span>
            <span className="truncate">{note.location}</span>
          </p>
        ) : (
          <span />
        )}
        <div className="group/sync relative shrink-0">
          <button
            type="button"
            aria-label={note.googleEventId ? "Update in Calendar" : "Add to Calendar"}
            onClick={(event) => {
              event.stopPropagation();
              handleSyncToCalendar();
            }}
            disabled={isSyncing}
            className={`rounded-full p-1 opacity-0 transition-opacity group-hover:opacity-70 disabled:opacity-40 ${
              note.googleEventId ? "text-emerald-600 dark:text-emerald-400" : ""
            }`}
          >
            {isSyncing ? (
              <SpinnerIcon className="h-8 w-8 animate-spin" />
            ) : note.googleEventId ? (
              <CalendarCheckIcon className="h-8 w-8" />
            ) : (
              <CalendarIcon className="h-8 w-8" />
            )}
          </button>
          <span className="pointer-events-none absolute bottom-full right-0 mb-1 whitespace-nowrap rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover/sync:opacity-90 dark:bg-zinc-100 dark:text-zinc-900">
            {isSyncing
              ? "Syncing…"
              : note.googleEventId
                ? "Synced — click to update"
                : "Add to Calendar"}
          </span>
        </div>
      </div>

      {syncError && (
        <p className="absolute inset-x-1 bottom-1 truncate text-[10px] text-red-700">
          {syncError}
        </p>
      )}
    </div>
  );
}
