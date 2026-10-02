"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { addNoteToGoogleCalendar } from "@/app/actions/calendar";
import { deleteNote, toggleNoteDone } from "@/app/actions/notes";
import { getNoteStyle } from "@/lib/noteColor";
import ConfirmDialog from "@/components/board/ConfirmDialog";
import FoldedCorner from "@/components/board/FoldedCorner";
import NoteForm from "@/components/board/NoteForm";
import type { NoteDTO } from "@/components/board/types";
import { FOCUS_RING } from "@/components/focusRing";
import {
  CalendarCheckIcon,
  CalendarIcon,
  CheckSquareIcon,
  ClockIcon,
  LocationIcon,
  SpinnerIcon,
  SquareIcon,
} from "@/components/board/icons";

export default function NoteCard({
  day,
  note,
  isNew = false,
}: {
  day: string;
  note: NoteDTO;
  /** Just appeared on the board, so it animates in. */
  isNew?: boolean;
}) {
  const t = useTranslations("board");
  const tErrors = useTranslations("errors");
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isSyncing, startSyncTransition] = useTransition();
  const [isToggling, startToggleTransition] = useTransition();
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [optimisticNote, setOptimisticNote] = useState<NoteDTO | null>(null);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: note.id });
  const noteStyle = getNoteStyle(note.id);

  const [lastServerNote, setLastServerNote] = useState(note);
  if (
    lastServerNote.title !== note.title ||
    lastServerNote.location !== note.location ||
    lastServerNote.description !== note.description ||
    lastServerNote.time !== note.time ||
    lastServerNote.isDone !== note.isDone ||
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
        note={displayNote}
        onDone={(updated) => {
          if (updated) setOptimisticNote(updated);
          setIsEditing(false);
        }}
      />
    );
  }

  function handleDelete() {
    setIsConfirmingDelete(false);
    // Hidden right away; the action's response drops it from the board.
    startDeleteTransition(async () => {
      await deleteNote(note.id);
    });
  }

  function handleToggleDone() {
    const nextIsDone = !displayNote.isDone;
    setOptimisticNote({ ...displayNote, isDone: nextIsDone });
    startToggleTransition(async () => {
      await toggleNoteDone(note.id, nextIsDone);
    });
  }

  function handleSyncToCalendar() {
    setSyncError(null);
    startSyncTransition(async () => {
      try {
        await addNoteToGoogleCalendar(note.id);
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
      className={`${isNew ? "animate-note-in" : ""} group relative ${isDeleting ? "hidden" : "flex"} h-44 w-44 cursor-pointer flex-col justify-between overflow-hidden rounded-sm border p-2 text-sm shadow-[2px_4px_6px_rgba(0,0,0,0.3)] transition-[top] hover:z-10 hover:-top-1 hover:shadow-[3px_6px_10px_rgba(0,0,0,0.35)] dark:shadow-[2px_4px_6px_rgba(0,0,0,0.6)] dark:hover:shadow-[3px_6px_10px_rgba(0,0,0,0.7)] sm:h-48 sm:w-48 ${isDragging ? "z-20" : ""} ${noteStyle.rotation} ${noteStyle.bg} ${noteStyle.border} ${noteStyle.text}`}
    >
      {displayNote.isDone && (
        <div className="pointer-events-none absolute inset-0 bg-zinc-500/40 mix-blend-multiply dark:bg-zinc-400/30" />
      )}
      <FoldedCorner />
      <div className="absolute left-1 top-1 flex items-center gap-1">
        <button
          type="button"
          aria-label={t("dragToReorder")}
          onClick={(event) => event.stopPropagation()}
          {...attributes}
          {...listeners}
          className={`cursor-grab touch-none select-none rounded-sm opacity-30 transition-opacity group-hover:opacity-70 active:cursor-grabbing pointer-coarse:-m-2 pointer-coarse:p-2 pointer-coarse:opacity-70 focus-visible:opacity-100 ${FOCUS_RING}`}
        >
          ⠿
        </button>
        <div className="group/done relative">
          <button
            type="button"
            aria-label={displayNote.isDone ? t("markAsPending") : t("markAsDone")}
            onClick={(event) => {
              event.stopPropagation();
              handleToggleDone();
            }}
            disabled={isToggling}
            className={`rounded-sm opacity-30 transition-opacity group-hover:opacity-70 pointer-coarse:opacity-70 focus-visible:opacity-100 ${FOCUS_RING}`}
          >
            {displayNote.isDone ? (
              <CheckSquareIcon className="h-3.5 w-3.5" />
            ) : (
              <SquareIcon className="h-3.5 w-3.5" />
            )}
          </button>
          <span className="pointer-events-none absolute left-0 top-full mt-1 whitespace-nowrap rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover/done:opacity-90 group-has-[:focus-visible]/done:opacity-90 dark:bg-zinc-100 dark:text-zinc-900">
            {displayNote.isDone ? t("markAsPending") : t("markAsDone")}
          </span>
        </div>
      </div>
      <button
        type="button"
        aria-label={t("deleteNote")}
        onClick={(event) => {
          event.stopPropagation();
          setIsConfirmingDelete(true);
        }}
        disabled={isDeleting}
        className={`absolute right-1 top-1 rounded-sm opacity-30 transition-opacity group-hover:opacity-70 disabled:opacity-30 pointer-coarse:opacity-70 focus-visible:opacity-100 ${FOCUS_RING}`}
      >
        ✕
      </button>

      <div className="mt-4 flex min-w-0 flex-1 flex-col overflow-hidden">
        <p className="flex items-center gap-1 text-xs font-medium opacity-80">
          <ClockIcon className="h-3 w-3 shrink-0" />
          {displayNote.time ?? "--:--"}
        </p>
        {/* Clamped so a long title can't push the description out; hover shows it whole. */}
        <p
          title={displayNote.title}
          className={`line-clamp-3 shrink-0 break-words font-semibold ${displayNote.isDone ? "line-through" : ""}`}
        >
          {displayNote.title}
        </p>
        {displayNote.description && (
          <p className="mt-0.5 flex-1 overflow-hidden whitespace-pre-wrap break-words text-[11px] leading-snug opacity-80">
            {displayNote.description}
          </p>
        )}
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
              !displayNote.time
                ? t("setTimeToSync")
                : displayNote.googleEventId
                  ? t("updateInCalendar")
                  : t("addToCalendar")
            }
            onClick={(event) => {
              event.stopPropagation();
              handleSyncToCalendar();
            }}
            disabled={isSyncing || !displayNote.time}
            className={`rounded-full p-1 opacity-30 transition-opacity group-hover:opacity-70 disabled:opacity-40 pointer-coarse:opacity-70 focus-visible:opacity-100 ${FOCUS_RING} ${
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
          <span className="pointer-events-none absolute bottom-full right-0 mb-1 whitespace-nowrap rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover/sync:opacity-90 group-has-[:focus-visible]/sync:opacity-90 dark:bg-zinc-100 dark:text-zinc-900">
            {!displayNote.time
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

      {isConfirmingDelete && (
        <ConfirmDialog
          title={t("confirmDeleteTitle")}
          message={t("confirmDeleteNote")}
          onConfirm={handleDelete}
          onCancel={() => setIsConfirmingDelete(false)}
        />
      )}
    </div>
  );
}
