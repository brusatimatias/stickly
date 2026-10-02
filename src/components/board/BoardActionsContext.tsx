"use client";

import { createContext, startTransition, useContext } from "react";
import type { NoteDTO } from "@/components/board/types";
import {
  sanitizeDescription,
  sanitizeLocation,
  sanitizeTitle,
  type NoteFields,
} from "@/lib/noteInput";

/** The container id of the drafts panel, next to the day keys (yyyy-MM-dd). */
export const DRAFT_CONTAINER = "draft";

export type BoardAction = {
  /**
   * Shows the result right away. It runs inside the action's transition, so
   * anything it sets with `useOptimistic` lasts until the action's response
   * (with the re-rendered board) commits, or is undone if the action fails.
   */
  optimistic?: () => void;
  /** The server action. Its error code is shown to the user if it throws. */
  action: () => Promise<unknown>;
  /** Undoes what `optimistic` can't (plain state, e.g. a drag's preview). */
  onError?: () => void;
};

type BoardActions = {
  /** Runs a board mutation; every one goes through here. */
  run: (boardAction: BoardAction) => void;
  /**
   * Shows a note being created in `container` (a day key or
   * `DRAFT_CONTAINER`) where the server will put it, last among the pending
   * notes. Call it from `optimistic`.
   */
  addPendingNote: (container: string, note: NoteDTO) => void;
};

/**
 * Provided by `Board`. The default (a card or form rendered outside the
 * board, in tests) just runs the action.
 */
const BoardActionsContext = createContext<BoardActions>({
  run: ({ optimistic, action }) =>
    startTransition(async () => {
      optimistic?.();
      await action();
    }),
  addPendingNote: () => {},
});

export const BoardActionsProvider = BoardActionsContext.Provider;

export function useBoardActions(): BoardActions {
  return useContext(BoardActionsContext);
}

/**
 * The note as the board shows it before the server answers, sanitized the
 * way the server will save it so the swap is invisible.
 */
export function toShownNote(
  id: string,
  values: NoteFields,
  rest: Pick<NoteDTO, "time" | "isDone" | "googleEventId">
): NoteDTO {
  return {
    id,
    title: sanitizeTitle(values.title),
    location: sanitizeLocation(values.location),
    description: sanitizeDescription(values.description),
    ...rest,
  };
}
