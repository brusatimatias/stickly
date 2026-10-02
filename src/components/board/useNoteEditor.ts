import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { NoteDTO } from "@/components/board/types";
import type { NoteFields } from "@/lib/noteInput";

/**
 * What the note and draft edit cards share: the title, location and
 * description being written, the note's id, focusing the title, and how the
 * editor closes. Clicking outside or Enter saves, Escape cancels, and
 * Shift+Enter inserts a line break in the description instead of saving.
 * Either way `onDone` closes it, once; `onSave` runs only with a title.
 */
export function useNoteEditor<TitleElement extends HTMLElement>({
  note,
  onDone,
  onSave,
}: {
  note?: NoteDTO;
  onDone: () => void;
  onSave: (id: string, fields: NoteFields) => void;
}) {
  const [title, setTitle] = useState(note?.title ?? "");
  const [location, setLocation] = useState(note?.location ?? "");
  const [description, setDescription] = useState(note?.description ?? "");
  // A new note's id is made here, so it can be shown before the server has it.
  const [id] = useState(() => note?.id ?? crypto.randomUUID());
  const titleRef = useRef<TitleElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const isClosedRef = useRef(false);

  function close(save: boolean) {
    if (isClosedRef.current) return;
    isClosedRef.current = true;
    onDone();
    if (save && title.trim()) onSave(id, { title, location, description });
  }

  // The outside click listener is added once, so it calls the latest `close`.
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        // Popovers (e.g. the time picker) are portaled to <body> so they can
        // escape the note card's rotated/overflow-hidden box, which puts
        // them outside containerRef even though they're part of this editor.
        if (target instanceof Element && target.closest("[data-note-popover]")) {
          return;
        }
        closeRef.current(true);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      const textarea = descriptionRef.current;
      if (textarea && event.target === textarea && event.shiftKey) {
        event.preventDefault();
        const { selectionStart, selectionEnd } = textarea;
        const cursor = selectionStart + 1;
        setDescription(description.slice(0, selectionStart) + "\n" + description.slice(selectionEnd));
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = cursor;
        });
        return;
      }
      event.preventDefault();
      close(true);
    }
    if (event.key === "Escape") {
      close(false);
    }
  }

  return {
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
  };
}
