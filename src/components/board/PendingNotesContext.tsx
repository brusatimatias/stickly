"use client";

import { createContext, useContext } from "react";
import type { NoteDTO } from "@/components/board/types";

/** The container id of the drafts panel, next to the day keys (yyyy-MM-dd). */
export const DRAFT_CONTAINER = "draft";

type PendingNotes = {
  /**
   * Shows a note that's being created in `container` (a day key or
   * `DRAFT_CONTAINER`) right away, where the server will put it: last among
   * the pending notes. The server data replaces it once it has the same id.
   */
  add: (container: string, note: NoteDTO) => void;
  /** Takes a note added with `add` off the board, when creating it failed. */
  drop: (id: string) => void;
};

/**
 * Provided by `Board`, so the forms can show a new note before the server
 * answers. The default does nothing (a form rendered outside the board).
 */
const PendingNotesContext = createContext<PendingNotes>({ add: () => {}, drop: () => {} });

export const PendingNotesProvider = PendingNotesContext.Provider;

export function usePendingNotes(): PendingNotes {
  return useContext(PendingNotesContext);
}
