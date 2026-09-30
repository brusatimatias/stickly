"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { useTranslations } from "next-intl";
import DraftCard from "@/components/board/DraftCard";
import DraftForm from "@/components/board/DraftForm";
import type { NoteDTO } from "@/components/board/types";
import { PlusIcon } from "@/components/board/icons";
import { useFormTransition } from "@/components/board/useFormTransition";
import { MAX_DRAFT_NOTES } from "@/lib/noteInput";
import { FOCUS_RING } from "@/components/focusRing";

export default function DraftPanel({
  notes,
  newNoteIds,
}: {
  notes: NoteDTO[];
  newNoteIds: ReadonlySet<string>;
}) {
  const t = useTranslations("board");
  const { setNodeRef } = useDroppable({ id: "draft" });
  const form = useFormTransition();
  const canCreate = notes.length < MAX_DRAFT_NOTES && !form.isMounted;

  return (
    <div
      ref={setNodeRef}
      className="flex w-full flex-col gap-3 rounded-lg border border-dashed border-zinc-200 p-3 dark:border-zinc-800 lg:w-44"
    >
      <header className="grid grid-cols-[1.25rem_1fr_1.25rem] pointer-coarse:grid-cols-[2.5rem_1fr_2.5rem] items-center">
        <span aria-hidden />
        <p className="text-center text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          {t("draft")}
        </p>
        {canCreate ? (
          <button
            type="button"
            onClick={form.open}
            aria-label={t("newDraftNote")}
            className={`inline-flex items-center justify-center justify-self-end rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 pointer-coarse:size-10 dark:text-zinc-600 dark:hover:bg-zinc-900 dark:hover:text-zinc-300 ${FOCUS_RING}`}
          >
            <PlusIcon className="h-3.5 w-3.5" />
          </button>
        ) : (
          <span aria-hidden />
        )}
      </header>

      <SortableContext id="draft" items={notes.map((note) => note.id)} strategy={rectSortingStrategy}>
        {/* Same grid as the day columns (one column in the narrow desktop
            panel, several on phones); each draft overlaps the one before it. */}
        <div className="grid auto-rows-min items-start justify-center gap-2 [grid-template-columns:repeat(auto-fill,minmax(11rem,1fr))] [&>*+*]:-mt-3">
          {notes.map((note) => (
            <DraftCard key={note.id} note={note} isNew={newNoteIds.has(note.id)} />
          ))}
          {form.isMounted && (
            <div {...form.transitionProps}>
              <DraftForm onDone={form.close} />
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}
