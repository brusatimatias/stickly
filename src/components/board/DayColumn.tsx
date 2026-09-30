"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { useTranslations } from "next-intl";
import NoteCard from "@/components/board/NoteCard";
import NoteForm from "@/components/board/NoteForm";
import type { BoardDay, NoteDTO } from "@/components/board/types";
import { ExpandIcon, PlusIcon } from "@/components/board/icons";
import { useFormTransition } from "@/components/board/useFormTransition";
import { FOCUS_RING } from "@/components/focusRing";

export default function DayColumn({
  day,
  notes,
  newNoteIds,
  todayKey,
  isFocused = false,
  onToggleFocus,
}: {
  day: BoardDay;
  notes: NoteDTO[];
  newNoteIds: ReadonlySet<string>;
  todayKey: string;
  isFocused?: boolean;
  onToggleFocus?: () => void;
}) {
  const t = useTranslations("board");
  const { setNodeRef, isOver } = useDroppable({ id: day.key });
  const form = useFormTransition();
  const isCurrentDay = day.key === todayKey;

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[16rem] w-full flex-col gap-3 rounded-lg border border-dashed p-2 transition-colors ${
        isOver
          ? "border-amber-400 bg-amber-50/60 dark:border-amber-700 dark:bg-amber-950/20"
          : "border-transparent"
      }`}
    >
      <header className="grid grid-cols-[auto_1fr_auto] items-center gap-1">
        {/* Invisible mirror of the right-side button cluster so the label stays centered regardless of how many buttons are shown there. */}
        <div className="flex items-center gap-0.5 opacity-0" aria-hidden>
          {!isFocused && onToggleFocus && (
            <span className="inline-flex items-center justify-center rounded-full p-1 pointer-coarse:size-10">
              <ExpandIcon className="h-3.5 w-3.5" />
            </span>
          )}
          <span className="inline-flex items-center justify-center rounded-full p-1 pointer-coarse:size-10">
            <PlusIcon className="h-3.5 w-3.5" />
          </span>
        </div>
        <p
          className={`flex items-center justify-center gap-1.5 text-center text-sm font-semibold ${
            isCurrentDay ? "text-amber-600 dark:text-amber-400" : "text-zinc-700 dark:text-zinc-300"
          }`}
        >
          {isCurrentDay && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />}
          {day.label}
        </p>
        <div className="flex items-center gap-0.5 justify-self-end">
          {!isFocused && onToggleFocus && (
            <button
              type="button"
              onClick={onToggleFocus}
              aria-label={t("focusDay")}
              className={`inline-flex items-center justify-center rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 pointer-coarse:size-10 dark:text-zinc-600 dark:hover:bg-zinc-900 dark:hover:text-zinc-300 ${FOCUS_RING}`}
            >
              <ExpandIcon className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={form.open}
            aria-label={t("addNote")}
            className={`inline-flex items-center justify-center rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 pointer-coarse:size-10 dark:text-zinc-600 dark:hover:bg-zinc-900 dark:hover:text-zinc-300 ${FOCUS_RING}`}
          >
            <PlusIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <SortableContext id={day.key} items={notes.map((note) => note.id)} strategy={rectSortingStrategy}>
        <div className="grid flex-1 auto-rows-min items-start justify-center gap-2 pt-3 [grid-template-columns:repeat(auto-fill,minmax(11rem,1fr))]">
          {notes.length === 0 && !form.isMounted && (
            <p className="text-xs text-zinc-400 dark:text-zinc-600">{t("noNotesYet")}</p>
          )}
          {notes.map((note) => (
            <NoteCard key={note.id} day={day.key} note={note} isNew={newNoteIds.has(note.id)} />
          ))}
          {form.isMounted && (
            <div {...form.transitionProps}>
              <NoteForm day={day.key} onDone={form.close} />
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}
