"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTransition } from "react";
import { createNote, updateNote } from "@/app/actions/notes";
import FoldedCorner from "@/components/board/FoldedCorner";
import { ClockIcon, LocationIcon } from "@/components/board/icons";
import type { NoteDTO } from "@/components/board/types";
import { getNoteStyle } from "@/lib/noteColor";

export default function NoteForm({
  day,
  note,
  onDone,
}: {
  day: string;
  note?: NoteDTO;
  onDone: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(note?.title ?? "");
  const [location, setLocation] = useState(note?.location ?? "");
  const [time, setTime] = useState(note && !note.hasTime ? "" : (note?.time ?? ""));
  const [, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const savedRef = useRef(false);
  const stateRef = useRef({ title, location, time });
  stateRef.current = { title, location, time };
  const noteStyle = getNoteStyle(note?.id ?? day);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        save();
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function save() {
    if (savedRef.current) return;
    savedRef.current = true;
    const { title, location, time } = stateRef.current;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      onDone();
      return;
    }
    startTransition(async () => {
      if (note) {
        await updateNote({ id: note.id, title: trimmedTitle, location, time });
      } else {
        await createNote({ title: trimmedTitle, location, day, time });
      }
      router.refresh();
      onDone();
    });
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      save();
    }
    if (event.key === "Escape") {
      savedRef.current = true;
      onDone();
    }
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
          <ClockIcon className="h-3 w-3 shrink-0" />
          <input
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
            aria-label="Time"
            className="w-fit bg-transparent outline-none [&::-webkit-calendar-picker-indicator]:hidden"
          />
          {time && (
            <button
              type="button"
              aria-label="Clear time"
              onClick={() => setTime("")}
              className="shrink-0 opacity-50 hover:opacity-90"
            >
              ✕
            </button>
          )}
        </div>
        <textarea
          ref={titleRef}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Title"
          aria-label="Title"
          rows={1}
          className="block w-full flex-1 resize-none break-words bg-transparent font-semibold outline-none placeholder:opacity-50"
        />
      </div>

      <div className="flex items-center gap-1 text-xs opacity-70">
        <LocationIcon className="h-3 w-3 shrink-0" />
        <input
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          placeholder="Location"
          aria-label="Location"
          className="w-full bg-transparent outline-none placeholder:opacity-40"
        />
      </div>
    </div>
  );
}
