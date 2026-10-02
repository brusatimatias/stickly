"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteNote } from "@/app/actions/notes";
import ConfirmDialog from "@/components/board/ConfirmDialog";
import DraftForm from "@/components/board/DraftForm";
import FoldedCorner from "@/components/board/FoldedCorner";
import { LocationIcon } from "@/components/board/icons";
import type { NoteDTO } from "@/components/board/types";
import { DRAFT_COLOR } from "@/lib/noteColor";
import { FOCUS_RING } from "@/components/focusRing";

export default function DraftCard({
  note,
  isNew = false,
}: {
  note: NoteDTO;
  /** Just appeared in the panel, so it animates in. */
  isNew?: boolean;
}) {
  const t = useTranslations("board");
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: note.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (isEditing) {
    return <DraftForm note={note} onDone={() => setIsEditing(false)} />;
  }

  function handleDelete() {
    setIsConfirmingDelete(false);
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
      className={`${isNew ? "animate-note-in" : ""} group relative flex h-44 w-44 -rotate-1 cursor-pointer flex-col justify-between overflow-hidden rounded-sm border p-2 text-sm shadow-md transition-[top] hover:z-10 hover:-top-1 hover:shadow-lg sm:h-48 sm:w-48 ${DRAFT_COLOR}`}
    >
      <FoldedCorner />
      <button
        type="button"
        aria-label={t("dragToSchedule")}
        onClick={(event) => event.stopPropagation()}
        {...attributes}
        {...listeners}
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
        disabled={isPending}
        className={`absolute right-1 top-1 rounded-sm opacity-0 transition-opacity group-hover:opacity-70 disabled:opacity-30 pointer-coarse:opacity-70 focus-visible:opacity-100 ${FOCUS_RING}`}
      >
        ✕
      </button>

      <div className="mt-4 flex min-w-0 flex-1 flex-col overflow-hidden">
        <p className="line-clamp-3 font-semibold">{note.title}</p>
        {note.description && (
          <p className="mt-0.5 flex-1 overflow-hidden whitespace-pre-wrap break-words text-[11px] leading-snug opacity-80">
            {note.description}
          </p>
        )}
      </div>

      <div className="flex items-end justify-between gap-1">
        {note.location ? (
          <p className="flex min-w-0 items-center gap-1 text-xs opacity-70">
            <LocationIcon className="h-3 w-3 shrink-0" />
            <span className="truncate">{note.location}</span>
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
