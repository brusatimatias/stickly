"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTransition } from "react";
import { saveDraftNote } from "@/app/actions/notes";
import FoldedCorner from "@/components/board/FoldedCorner";
import type { NoteDTO } from "@/components/board/types";

export default function DraftForm({
  note,
  onDone,
}: {
  note?: NoteDTO;
  onDone: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(note?.title ?? "");
  const [location, setLocation] = useState(note?.location ?? "");
  const [, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const savedRef = useRef(false);
  const stateRef = useRef({ title, location });
  stateRef.current = { title, location };

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
    const { title, location } = stateRef.current;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      onDone();
      return;
    }
    startTransition(async () => {
      await saveDraftNote({ title: trimmedTitle, location });
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
      className="relative flex h-44 w-44 -rotate-1 flex-col justify-between overflow-hidden rounded-sm border border-orange-300 bg-orange-200 p-2 text-sm text-orange-950 shadow-md sm:h-48 sm:w-48"
    >
      <FoldedCorner />
      <div className="mt-4 min-w-0">
        <input
          ref={titleRef}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Title"
          aria-label="Title"
          className="block w-full bg-transparent font-semibold outline-none placeholder:opacity-50"
        />
      </div>

      <div className="flex items-end justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1 text-xs opacity-70">
          <span aria-hidden>📍</span>
          <input
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Location"
            aria-label="Location"
            className="w-full bg-transparent outline-none placeholder:opacity-40"
          />
        </div>
        <span className="shrink-0 text-[10px] opacity-60">Click outside</span>
      </div>
    </div>
  );
}
