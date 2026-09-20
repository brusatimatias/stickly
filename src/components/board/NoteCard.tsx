"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addNoteToGoogleCalendar } from "@/app/actions/calendar";
import { deleteNote } from "@/app/actions/notes";
import { getNoteStyle } from "@/lib/noteColor";
import FoldedCorner from "@/components/board/FoldedCorner";
import NoteForm from "@/components/board/NoteForm";
import type { NoteDTO } from "@/components/board/types";
import {
  CalendarCheckIcon,
  CalendarIcon,
  ClockIcon,
  LocationIcon,
  SpinnerIcon,
} from "@/components/board/icons";

export default function NoteCard({ day, note }: { day: string; note: NoteDTO }) {
  const t = useTranslations("board");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isSyncing, startSyncTransition] = useTransition();
  const [syncError, setSyncError] = useState<string | null>(null);
  const [optimisticNote, setOptimisticNote] = useState<NoteDTO | null>(null);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: note.id });
  const noteStyle = getNoteStyle(note.id);

  const [lastServerNote, setLastServerNote] = useState(note);
  if (
    lastServerNote.title !== note.title ||
    lastServerNote.location !== note.location ||
    lastServerNote.time !== note.time ||
    lastServerNote.hasTime !== note.hasTime ||
    lastServerNote.googleEventId !== note.googleEventId
  ) {
    setLastServerNote(note);
    if (optimisticNote) setOptimisticNote(null);
  }
  const displayNote = optimisticNote ?? note;

  const style = {
    ...noteStyle.overlapStyle,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (isEditing) {
    return (
      <NoteForm
        day={day}
        note={note}
        onDone={(updated) => {
          if (updated) setOptimisticNote(updated);
          setIsEditing(false);
        }}
      />
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
        const code = error instanceof Error ? error.message : undefined;
        setSyncError(code && tErrors.has(code) ? tErrors(code) : tErrors("GENERIC"));
      }
    });
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => setIsEditing(true)}
      className={`group relative flex h-44 w-44 cursor-pointer flex-col justify-between overflow-hidden rounded-sm border p-2 text-sm shadow-[2px_4px_6px_rgba(0,0,0,0.3)] transition-transform hover:z-10 hover:scale-105 hover:shadow-[3px_6px_10px_rgba(0,0,0,0.35)] dark:shadow-[2px_4px_6px_rgba(0,0,0,0.6)] dark:hover:shadow-[3px_6px_10px_rgba(0,0,0,0.7)] sm:h-48 sm:w-48 ${isDragging ? "z-20" : ""} ${noteStyle.rotation} ${noteStyle.bg} ${noteStyle.border} ${noteStyle.text}`}
    >
      <FoldedCorner />
      <button
        type="button"
        aria-label={t("dragToReorder")}
        onClick={(event) => event.stopPropagation()}
        {...attributes}
        {...listeners}
        className="absolute left-1 top-1 cursor-grab select-none opacity-30 transition-opacity group-hover:opacity-70 active:cursor-grabbing"
      >
        ⠿
      </button>
      <button
        type="button"
        aria-label={t("deleteNote")}
        onClick={(event) => {
          event.stopPropagation();
          handleDelete();
        }}
        disabled={isPending}
        className="absolute right-1 top-1 opacity-30 transition-opacity group-hover:opacity-70 disabled:opacity-30"
      >
        ✕
      </button>

      <div className="mt-4 flex min-w-0 flex-1 flex-col overflow-hidden">
        <p className="flex items-center gap-1 text-xs font-medium opacity-80">
          <ClockIcon className="h-3 w-3 shrink-0" />
          {displayNote.hasTime ? displayNote.time : "--:--"}
        </p>
        <p className="break-words font-semibold">{displayNote.title}</p>
      </div>

      <div className="flex items-end justify-between gap-1">
        {displayNote.location ? (
          <p className="flex min-w-0 items-center gap-1 text-xs opacity-70">
            <LocationIcon className="h-3 w-3 shrink-0" />
            <span className="truncate">{displayNote.location}</span>
          </p>
        ) : (
          <span />
        )}
        <div className="group/sync relative shrink-0">
          <button
            type="button"
            aria-label={
              !displayNote.hasTime
                ? t("setTimeToSync")
                : displayNote.googleEventId
                  ? t("updateInCalendar")
                  : t("addToCalendar")
            }
            onClick={(event) => {
              event.stopPropagation();
              handleSyncToCalendar();
            }}
            disabled={isSyncing || !displayNote.hasTime}
            className={`rounded-full p-1 opacity-30 transition-opacity group-hover:opacity-70 disabled:opacity-40 ${
              displayNote.googleEventId ? "text-emerald-600 dark:text-emerald-400" : ""
            }`}
          >
            {isSyncing ? (
              <SpinnerIcon className="h-8 w-8 animate-spin" />
            ) : displayNote.googleEventId ? (
              <CalendarCheckIcon className="h-8 w-8" />
            ) : (
              <CalendarIcon className="h-8 w-8" />
            )}
          </button>
          <span className="pointer-events-none absolute bottom-full right-0 mb-1 whitespace-nowrap rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover/sync:opacity-90 dark:bg-zinc-100 dark:text-zinc-900">
            {!displayNote.hasTime
              ? t("setTimeToSyncShort")
              : isSyncing
                ? t("syncing")
                : displayNote.googleEventId
                  ? t("syncedClickToUpdate")
                  : t("addToCalendar")}
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
