"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { useTranslations } from "next-intl";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { DRAFT_CONTAINER } from "@/components/board/BoardActionsContext";
import DraftCard from "@/components/board/DraftCard";
import DraftForm from "@/components/board/DraftForm";
import type { NoteDTO } from "@/components/board/types";
import { ChevronDownIcon, PlusIcon } from "@/components/icons";
import { useFormTransition } from "@/components/board/useFormTransition";
import { MAX_DRAFT_NOTES } from "@/lib/noteInput";
import { DRAFT_COLOR } from "@/lib/noteColor";
import { FOCUS_RING } from "@/components/focusRing";

const ICON_BUTTON = `inline-flex items-center justify-center rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 pointer-coarse:size-10 dark:text-zinc-600 dark:hover:bg-zinc-900 dark:hover:text-zinc-300 ${FOCUS_RING}`;

/**
 * The drafts as a tray above the week. Collapsed it's a single row with the
 * drafts' titles, so the week gets the space; expanded it shows the cards,
 * which is the only way to drag one (a collapsed tray renders no sortable
 * items, and only drafts may be dropped into it).
 *
 * While a note is dragged the tray keeps its height: it sits above the week,
 * so shrinking it as a draft leaves would shift every day under the pointer
 * (the rect-shift feedback that caused drag loops before).
 */
export default function DraftPanel({
  notes,
  newNoteIds,
  isDragging,
}: {
  notes: NoteDTO[];
  newNoteIds: ReadonlySet<string>;
  /** A note is being dragged anywhere on the board. */
  isDragging: boolean;
}) {
  const t = useTranslations("board");
  const { setNodeRef } = useDroppable({ id: DRAFT_CONTAINER });
  const form = useFormTransition();
  const [isExpanded, setIsExpanded] = useState(false);
  const canCreate = notes.length < MAX_DRAFT_NOTES && !form.isMounted;
  const bodyId = useId();
  const bodyRef = useRef<HTMLDivElement>(null);
  const isBodyShown = (isExpanded && (notes.length > 0 || isDragging)) || form.isMounted;

  // Written to the DOM, not state: it only pins the height measured when the
  // drag starts, and must not re-render the tray mid-drag.
  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    body.style.minHeight = isDragging ? `${body.offsetHeight}px` : "";
  }, [isDragging]);

  function openForm() {
    setIsExpanded(true);
    form.open();
  }

  return (
    <section
      ref={setNodeRef}
      aria-label={t("draft")}
      className="flex w-full flex-col gap-3 rounded-lg border border-dashed border-zinc-200 px-3 py-1.5 dark:border-zinc-800"
    >
      <header className="flex min-h-8 items-center gap-2">
        <p className="shrink-0 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          {t("draft")}
        </p>
        <span className="shrink-0 text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
          {notes.length}/{MAX_DRAFT_NOTES}
        </span>

        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden py-1">
          {notes.length === 0 && !form.isMounted ? (
            <p className="text-xs leading-snug text-zinc-400 dark:text-zinc-500">
              {t("emptyDraftsHint", { count: MAX_DRAFT_NOTES })}
            </p>
          ) : (
            !isExpanded && (
              // A mouse shortcut to expand; keyboard and screen reader users
              // get the same through the toggle, so it's no tab stop.
              <button
                type="button"
                tabIndex={-1}
                aria-hidden
                onClick={() => setIsExpanded(true)}
                className="flex min-w-0 cursor-pointer gap-2"
              >
                {notes.map((note) => (
                  <span
                    key={note.id}
                    title={note.title}
                    className={`max-w-40 shrink-0 -rotate-1 truncate rounded-sm border px-2 py-1 text-xs font-semibold shadow-sm ${DRAFT_COLOR}`}
                  >
                    {note.title}
                  </span>
                ))}
              </button>
            )
          )}
        </div>

        {canCreate && (
          <button type="button" onClick={openForm} aria-label={t("newDraftNote")} className={ICON_BUTTON}>
            <PlusIcon className="h-3.5 w-3.5" />
          </button>
        )}
        {notes.length > 0 && !form.isMounted && (
          <button
            type="button"
            onClick={() => setIsExpanded((expanded) => !expanded)}
            aria-expanded={isExpanded}
            aria-controls={bodyId}
            aria-label={isExpanded ? t("hideDrafts") : t("showDrafts")}
            className={ICON_BUTTON}
          >
            <ChevronDownIcon
              className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            />
          </button>
        )}
      </header>

      {isBodyShown && (
        <SortableContext id="draft" items={notes.map((note) => note.id)} strategy={rectSortingStrategy}>
          {/* A grid, not flex-wrap, as in the day columns (see ui-conventions),
              but with card-sized tracks: one row of drafts on a wide screen,
              two per row on a phone. */}
          <div
            id={bodyId}
            ref={bodyRef}
            className="grid auto-rows-min items-start gap-3 pb-2.5 [grid-template-columns:repeat(auto-fill,minmax(min(10rem,100%),12rem))]">
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
      )}
    </section>
  );
}
