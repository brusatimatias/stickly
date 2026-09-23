import { useEffect, useRef, type KeyboardEvent } from "react";

/**
 * Shared keyboard/outside-click wiring for the note/draft edit cards:
 * click outside or Enter saves, Escape cancels, and Shift+Enter inserts
 * a line break in the description instead of saving. Each caller keeps its
 * own save/cancel logic (persistence, validation, savedRef guard) — this
 * hook only wires the DOM events to it.
 */
export function useNoteEditorKeyboard({
  save,
  cancel,
  description,
  setDescription,
}: {
  save: () => void;
  cancel: () => void;
  description: string;
  setDescription: (value: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

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
      save();
    }
    if (event.key === "Escape") {
      cancel();
    }
  }

  return { containerRef, descriptionRef, handleKeyDown };
}
