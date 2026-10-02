"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useTransition } from "react";
import { createNote, updateNote } from "@/app/actions/notes";
import FoldedCorner from "@/components/board/FoldedCorner";
import { LocationIcon } from "@/components/board/icons";
import { usePendingNotes } from "@/components/board/PendingNotesContext";
import TimePicker from "@/components/board/TimePicker";
import { useBoardTimeZone } from "@/components/board/TimeZoneContext";
import type { NoteDTO } from "@/components/board/types";
import { useNoteEditorKeyboard } from "@/components/board/useNoteEditorKeyboard";
import { getNoteStyle } from "@/lib/noteColor";
import { sanitizeDescription, sanitizeLocation, sanitizeTitle } from "@/lib/noteInput";
import { toScheduleInput, toStoredSchedule } from "@/lib/schedule";

export default function NoteForm({
  day,
  note,
  onDone,
}: {
  day: string;
  note?: NoteDTO;
  onDone: (updated?: NoteDTO) => void;
}) {
  const t = useTranslations("board");
  const timeZone = useBoardTimeZone();
  const pendingNotes = usePendingNotes();
  const [title, setTitle] = useState(note?.title ?? "");
  const [location, setLocation] = useState(note?.location ?? "");
  const [description, setDescription] = useState(note?.description ?? "");
  const [time, setTime] = useState(note?.time ?? "");
  const [, startTransition] = useTransition();
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const savedRef = useRef(false);
  const stateRef = useRef({ title, location, description, time });
  const [newNoteId] = useState(() => note?.id ?? crypto.randomUUID());
  const noteStyle = getNoteStyle(newNoteId);

  useEffect(() => {
    stateRef.current = { title, location, description, time };
  });

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const { containerRef, descriptionRef, handleKeyDown } = useNoteEditorKeyboard({
    save,
    cancel,
    description,
    setDescription,
  });

  function save() {
    if (savedRef.current) return;
    savedRef.current = true;
    const { title, location, description, time } = stateRef.current;
    if (!title.trim()) {
      onDone();
      return;
    }
    // Shown right away, sanitized as the server will save it.
    const shown: NoteDTO = {
      id: newNoteId,
      title: sanitizeTitle(title),
      location: sanitizeLocation(location),
      description: sanitizeDescription(description),
      time: time || null,
      isDone: note?.isDone ?? false,
      googleEventId: note?.googleEventId ?? null,
    };
    if (note) {
      onDone(shown);
    } else {
      onDone();
      pendingNotes.add(day, shown);
    }
    // The day and time are typed in the board's zone; the server stores UTC.
    const schedule = toScheduleInput(toStoredSchedule(day, time || null, timeZone));
    const input = { id: newNoteId, title: shown.title, location, description, schedule };
    startTransition(async () => {
      if (note) {
        await updateNote(input);
        return;
      }
      try {
        await createNote(input);
      } catch (error) {
        pendingNotes.drop(newNoteId);
        throw error;
      }
    });
  }

  function cancel() {
    savedRef.current = true;
    onDone();
  }

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      style={noteStyle.overlapStyle}
      className={`relative flex h-44 w-44 flex-col justify-between overflow-hidden rounded-sm border p-2 text-sm shadow-[2px_4px_6px_rgba(0,0,0,0.3)] dark:shadow-[2px_4px_6px_rgba(0,0,0,0.6)] sm:h-48 sm:w-48 ${noteStyle.rotation} ${noteStyle.bg} ${noteStyle.border} ${noteStyle.text}`}
    >
      <FoldedCorner />
      <div className="mt-4 flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-1 text-xs font-medium opacity-80">
          <TimePicker value={time} onChange={setTime} />
        </div>
        <textarea
          ref={titleRef}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t("titlePlaceholder")}
          aria-label={t("titlePlaceholder")}
          rows={1}
          className="block w-full resize-none break-words bg-transparent font-semibold outline-none placeholder:opacity-50"
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

      <div className="flex items-center gap-1 text-xs opacity-70">
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
