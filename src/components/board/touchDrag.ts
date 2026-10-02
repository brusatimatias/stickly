import type { useSortable } from "@dnd-kit/sortable";
import type { TouchEventHandler } from "react";

type DragListeners = ReturnType<typeof useSortable>["listeners"];

/**
 * Splits a sortable card's listeners by input: a touch starts the drag from
 * anywhere on the card (after the TouchSensor's press delay, so a swipe still
 * scrolls), while the mouse and keyboard keep using the drag handle. dnd-kit
 * names each listener after its sensor's activator event (`onTouchStart`,
 * `onMouseDown`, `onKeyDown`), so the split is by name. dnd-kit itself blocks
 * the context menu during the press and the click that would follow a drag.
 */
export function splitDragListeners(listeners: DragListeners) {
  const { onTouchStart, ...handle } = listeners ?? {};
  return {
    card: {
      // dnd-kit types its listeners as plain `Function`s.
      onTouchStart: onTouchStart as TouchEventHandler | undefined,
    },
    handle,
  };
}

/** Keeps a long press from selecting the card's text or opening iOS's callout. */
export const TOUCH_DRAG_CARD = "pointer-coarse:select-none [-webkit-touch-callout:none]";
