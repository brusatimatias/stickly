import { describe, expect, test, vi } from "vitest";
import { splitDragListeners } from "@/components/board/touchDrag";

describe("splitDragListeners", () => {
  test("gives the touch listener to the card and the rest to the handle", () => {
    const listeners = { onTouchStart: vi.fn(), onMouseDown: vi.fn(), onKeyDown: vi.fn() };

    const { card, handle } = splitDragListeners(listeners);

    expect(card.onTouchStart).toBe(listeners.onTouchStart);
    expect(handle).toEqual({ onMouseDown: listeners.onMouseDown, onKeyDown: listeners.onKeyDown });
  });

  test("handles a card without listeners", () => {
    const { card, handle } = splitDragListeners(undefined);

    expect(card.onTouchStart).toBeUndefined();
    expect(handle).toEqual({});
  });
});
