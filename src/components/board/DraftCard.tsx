"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteNote } from "@/app/actions/notes";
import DraftForm from "@/components/board/DraftForm";
import FoldedCorner from "@/components/board/FoldedCorner";
import type { NoteDTO } from "@/components/board/types";

export default function DraftCard({ note }: { note: NoteDTO }) {
  const t = useTranslations("board");
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
    return <DraftForm note={note} onDone={() => setIsEditing(false)} />;
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
      className="group relative flex h-44 w-44 -rotate-1 cursor-pointer flex-col justify-between overflow-hidden rounded-sm border border-orange-300 bg-orange-200 p-2 text-sm text-orange-950 shadow-md transition-transform hover:z-10 hover:scale-105 hover:shadow-lg sm:h-48 sm:w-48"
    >
      <FoldedCorner />
      <button
        type="button"
        aria-label={t("dragToSchedule")}
        onClick={(event) => event.stopPropagation()}
        {...attributes}
        {...listeners}
        className="absolute left-1 top-1 cursor-grab select-none opacity-0 transition-opacity group-hover:opacity-70 active:cursor-grabbing"
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
        className="absolute right-1 top-1 opacity-0 transition-opacity group-hover:opacity-70 disabled:opacity-30"
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
            <span aria-hidden>📍</span>
            <span className="truncate">{note.location}</span>
          </p>
        ) : (
          <span />
        )}
        <span className="shrink-0 text-[10px] opacity-70">{t("dragArrow")}</span>
      </div>
    </div>
  );
}
