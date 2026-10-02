"use client";

import { useTranslations } from "next-intl";
import { createDraftNote, updateDraftNote } from "@/app/actions/notes";
import {
  DRAFT_CONTAINER,
  toShownNote,
  useBoardActions,
} from "@/components/board/BoardActionsContext";
import FoldedCorner from "@/components/board/FoldedCorner";
import { LocationIcon } from "@/components/icons";
import type { NoteDTO } from "@/components/board/types";
import { useNoteEditor } from "@/components/board/useNoteEditor";
import { DRAFT_COLOR } from "@/lib/noteColor";
import type { NoteFields } from "@/lib/noteInput";

export default function DraftForm({
  note,
  onDone,
  showSaved,
}: {
  /** The draft being edited; a new one is created without it. */
  note?: NoteDTO;
  /** Closes the form, right away (it doesn't wait for the server). */
  onDone: () => void;
  /** Shows the saved edit on the card until the server answers. */
  showSaved?: (note: NoteDTO) => void;
}) {
  const t = useTranslations("board");
  const { run, addPendingNote } = useBoardActions();
  const {
    title,
    setTitle,
    location,
    setLocation,
    description,
    setDescription,
    titleRef,
    containerRef,
    descriptionRef,
    handleKeyDown,
  } = useNoteEditor<HTMLInputElement>({ note, onDone, onSave: save });

  function save(id: string, fields: NoteFields) {
    const shown = toShownNote(id, fields, { time: null, isDone: false, googleEventId: null });
    const input = { id, ...fields };
    run(
      note
        ? { optimistic: () => showSaved?.(shown), action: () => updateDraftNote(input) }
        : {
            optimistic: () => addPendingNote(DRAFT_CONTAINER, shown),
            action: () => createDraftNote(input),
          }
    );
  }

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      className={`relative flex h-44 w-44 -rotate-1 flex-col justify-between overflow-hidden rounded-sm border p-2 text-sm shadow-md sm:h-48 sm:w-48 ${DRAFT_COLOR}`}
    >
      <FoldedCorner />
      <div className="mt-4 flex min-w-0 flex-1 flex-col overflow-hidden">
        <input
          ref={titleRef}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t("titlePlaceholder")}
          aria-label={t("titlePlaceholder")}
          className="block w-full bg-transparent font-semibold outline-none placeholder:opacity-50"
        />
        <textarea
          ref={descriptionRef}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={t("descriptionPlaceholder")}
          aria-label={t("descriptionPlaceholder")}
          rows={2}
          className="mt-0.5 block w-full flex-1 resize-none bg-transparent text-[11px] leading-snug text-current/80 outline-none placeholder:opacity-40"
        />
      </div>

      <div className="flex items-end justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1 text-xs opacity-70">
          <LocationIcon className="h-3 w-3 shrink-0" />
          <input
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder={t("locationPlaceholder")}
            aria-label={t("locationPlaceholder")}
            className="w-full bg-transparent outline-none placeholder:opacity-40"
          />
        </div>
        <span className="shrink-0 text-[10px] opacity-60">{t("clickOutside")}</span>
      </div>
    </div>
  );
}
