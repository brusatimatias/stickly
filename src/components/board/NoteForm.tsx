"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTransition } from "react";
import { createNote, updateNote } from "@/app/actions/notes";
import FoldedCorner from "@/components/board/FoldedCorner";
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
  const [time, setTime] = useState(note?.time ?? "09:00");
  const [, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
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
      className={`relative flex h-44 w-44 flex-col justify-between overflow-hidden rounded-sm border p-2 text-sm shadow-md sm:h-48 sm:w-48 ${noteStyle.rotation} ${noteStyle.bg} ${noteStyle.border} ${noteStyle.text}`}
    >
      <FoldedCorner />
      <div className="mt-4 min-w-0">
        <div className="flex items-center gap-1 text-xs font-medium opacity-80">
          <span aria-hidden>🕐</span>
          <input
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
            aria-label="Time"
            className="w-fit bg-transparent outline-none [&::-webkit-calendar-picker-indicator]:hidden"
          />
        </div>
        <input
          ref={titleRef}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Title"
          aria-label="Title"
          className="block w-full bg-transparent font-semibold outline-none placeholder:opacity-50"
        />
      </div>

      <div className="flex items-center gap-1 text-xs opacity-70">
        <span aria-hidden>📍</span>
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
