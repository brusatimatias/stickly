"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslations } from "next-intl";
import { useOptimistic, useState } from "react";
import { deleteNote } from "@/app/actions/notes";
import { useBoardActions } from "@/components/board/BoardActionsContext";
import ConfirmDialog from "@/components/board/ConfirmDialog";
import DraftForm from "@/components/board/DraftForm";
import FoldedCorner from "@/components/board/FoldedCorner";
import { LocationIcon } from "@/components/icons";
import type { NoteDTO } from "@/components/board/types";
import { DRAFT_COLOR } from "@/lib/noteColor";
import { FOCUS_RING } from "@/components/focusRing";
import { TOUCH_DRAG_CARD, splitDragListeners } from "@/components/board/touchDrag";

export default function DraftCard({
  note,
  isNew = false,
}: {
  note: NoteDTO;
  /** Just appeared in the panel, so it animates in. */
  isNew?: boolean;
}) {
  const t = useTranslations("board");
  const { run } = useBoardActions();
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  // What the card shows while its edits or deletion are on their way; back
  // to the server's `note` once each response commits (or fails).
  const [displayNote, setDisplayNote] = useOptimistic(note);
  const [isDeleted, setIsDeleted] = useOptimistic(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: note.id });
  const dragListeners = splitDragListeners(listeners);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (isEditing) {
    return (
      <DraftForm
        note={displayNote}
        onDone={() => setIsEditing(false)}
        showSaved={setDisplayNote}
      />
    );
  }

  function handleDelete() {
    setIsConfirmingDelete(false);
    run({ optimistic: () => setIsDeleted(true), action: () => deleteNote(note.id) });
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => setIsEditing(true)}
      {...dragListeners.card}
      className={`${isNew ? "animate-note-in" : ""} group relative ${isDeleted ? "hidden" : "flex"} aspect-square w-full max-w-44 -rotate-1 cursor-pointer flex-col justify-between ${TOUCH_DRAG_CARD} overflow-hidden rounded-sm border p-2 text-sm shadow-md transition-[top] hover:z-10 hover:-top-1 hover:shadow-lg sm:max-w-48 ${DRAFT_COLOR}`}
    >
      <FoldedCorner />
      <button
        type="button"
        aria-label={t("dragToSchedule")}
        onClick={(event) => event.stopPropagation()}
        {...attributes}
        {...dragListeners.handle}
        className={`absolute left-1 top-1 cursor-grab touch-none select-none rounded-sm opacity-0 transition-opacity group-hover:opacity-70 active:cursor-grabbing pointer-coarse:-m-2 pointer-coarse:p-2 pointer-coarse:opacity-70 focus-visible:opacity-100 ${FOCUS_RING}`}
      >
        ⠿
      </button>
      <button
        type="button"
        aria-label={t("deleteNote")}
        onClick={(event) => {
          event.stopPropagation();
          setIsConfirmingDelete(true);
        }}
        className={`absolute right-1 top-1 rounded-sm opacity-0 transition-opacity group-hover:opacity-70 pointer-coarse:opacity-70 focus-visible:opacity-100 ${FOCUS_RING}`}
      >
        ✕
      </button>

      <div className="mt-4 flex min-w-0 flex-1 flex-col overflow-hidden">
        <p className="line-clamp-3 font-semibold">{displayNote.title}</p>
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
        <span className="shrink-0 text-[10px] opacity-70">{t("dragArrow")}</span>
      </div>

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
