"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { createNote, updateNote } from "@/app/actions/notes";
import { toShownNote, useBoardActions } from "@/components/board/BoardActionsContext";
import FoldedCorner from "@/components/board/FoldedCorner";
import TimePicker from "@/components/board/TimePicker";
import { useBoardTimeZone } from "@/components/board/TimeZoneContext";
import type { NoteDTO } from "@/components/board/types";
import { useNoteEditor } from "@/components/board/useNoteEditor";
import { LocationIcon } from "@/components/icons";
import { getNoteStyle } from "@/lib/noteColor";
import type { NoteFields } from "@/lib/noteInput";
import { toScheduleInput, toStoredSchedule } from "@/lib/schedule";

export default function NoteForm({
  day,
  note,
  onDone,
  showSaved,
}: {
  day: string;
  /** The note being edited; a new one is created without it. */
  note?: NoteDTO;
  /** Closes the form, right away (it doesn't wait for the server). */
  onDone: () => void;
  /** Shows the saved edit on the card until the server answers. */
  showSaved?: (note: NoteDTO) => void;
}) {
  const t = useTranslations("board");
  const timeZone = useBoardTimeZone();
  const { run, addPendingNote } = useBoardActions();
  const [time, setTime] = useState(note?.time ?? "");
  const {
    id,
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
  } = useNoteEditor<HTMLTextAreaElement>({ note, onDone, onSave: save });
  const noteStyle = getNoteStyle(id);

  function save(id: string, fields: NoteFields) {
    const shown = toShownNote(id, fields, {
      time: time || null,
      isDone: note?.isDone ?? false,
      googleEventId: note?.googleEventId ?? null,
    });
    // The day and time are typed in the board's zone; the server stores UTC.
    const input = {
      id,
      ...fields,
      schedule: toScheduleInput(toStoredSchedule(day, time || null, timeZone)),
    };
    run(
      note
        ? { optimistic: () => showSaved?.(shown), action: () => updateNote(input) }
        : { optimistic: () => addPendingNote(day, shown), action: () => createNote(input) }
    );
  }

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      style={noteStyle.overlapStyle}
      className={`@container relative flex aspect-square min-h-40 w-full max-w-44 flex-col justify-between overflow-hidden rounded-sm border p-2 text-sm shadow-[2px_4px_6px_rgba(0,0,0,0.3)] dark:shadow-[2px_4px_6px_rgba(0,0,0,0.6)] sm:max-w-48 ${noteStyle.rotation} ${noteStyle.bg} ${noteStyle.border} ${noteStyle.text}`}
    >
      <FoldedCorner />
      <div className="mt-4 flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-1 text-xs font-medium opacity-80 @max-[9rem]:text-[11px]">
          <TimePicker value={time} onChange={setTime} />
        </div>
        <textarea
          ref={titleRef}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t("titlePlaceholder")}
          aria-label={t("titlePlaceholder")}
          rows={1}
          className="block w-full resize-none break-words bg-transparent font-semibold outline-none @max-[9rem]:text-[13px] @max-[9rem]:leading-snug placeholder:opacity-50"
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

      <div className="flex items-center gap-1 text-xs opacity-70 @max-[9rem]:text-[11px]">
        <LocationIcon className="h-3 w-3 shrink-0" />
        <input
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          placeholder={t("locationPlaceholder")}
          aria-label={t("locationPlaceholder")}
          className="w-full bg-transparent outline-none placeholder:opacity-40"
        />
      </div>
    </div>
  );
}
