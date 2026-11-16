import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { WEEK_FLIP_DELAY_MS, useWeekFlip } from "@/components/board/useWeekFlip";

const WEEK = { weekStart: "2026-09-28", prevWeekParam: "2026-09-21", nextWeekParam: "2026-10-05" };
const NEXT_WEEK = { weekStart: "2026-10-05", prevWeekParam: "2026-09-28", nextWeekParam: "2026-10-12" };

beforeEach(() => {
  vi.useFakeTimers();
  push.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

function renderFlip() {
  return renderHook((props: typeof WEEK) => useWeekFlip(props), { initialProps: WEEK });
}

describe("useWeekFlip", () => {
  test("changes week once the note has been held over the arrow for the delay", () => {
    const { result } = renderFlip();

    act(() => result.current.start("next"));
    act(() => vi.advanceTimersByTime(WEEK_FLIP_DELAY_MS - 1));
    expect(push).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(push).toHaveBeenCalledExactlyOnceWith("/?week=2026-10-05", { scroll: false });
  });

  test("waits for the new week before counting the next change", () => {
    const { result, rerender } = renderFlip();
    act(() => result.current.start("next"));
    act(() => vi.advanceTimersByTime(WEEK_FLIP_DELAY_MS));

    // Still loading: no second change, however long it takes.
    act(() => vi.advanceTimersByTime(WEEK_FLIP_DELAY_MS * 3));
    expect(push).toHaveBeenCalledOnce();

    rerender(NEXT_WEEK);
    act(() => vi.advanceTimersByTime(WEEK_FLIP_DELAY_MS));
    expect(push).toHaveBeenLastCalledWith("/?week=2026-10-12", { scroll: false });
  });

  test("doesn't change week if the note leaves the arrow first", () => {
    const { result } = renderFlip();

    act(() => result.current.start("prev"));
    act(() => vi.advanceTimersByTime(WEEK_FLIP_DELAY_MS / 2));
    act(() => result.current.stop());
    act(() => vi.advanceTimersByTime(WEEK_FLIP_DELAY_MS));

    expect(push).not.toHaveBeenCalled();
  });

  test("doesn't restart the wait while the note stays over the same arrow", () => {
    const { result } = renderFlip();

    act(() => result.current.start("prev"));
    act(() => vi.advanceTimersByTime(WEEK_FLIP_DELAY_MS / 2));
    act(() => result.current.start("prev"));
    act(() => vi.advanceTimersByTime(WEEK_FLIP_DELAY_MS / 2));

    expect(push).toHaveBeenCalledExactlyOnceWith("/?week=2026-09-21", { scroll: false });
  });

  test("doesn't keep changing week after the drag ends while one loads", () => {
    const { result, rerender } = renderFlip();
    act(() => result.current.start("next"));
    act(() => vi.advanceTimersByTime(WEEK_FLIP_DELAY_MS));
    act(() => result.current.stop());

    rerender(NEXT_WEEK);
    act(() => vi.advanceTimersByTime(WEEK_FLIP_DELAY_MS * 2));

    expect(push).toHaveBeenCalledOnce();
  });

  test("starts the wait over when the note moves to the other arrow", () => {
    const { result } = renderFlip();

    act(() => result.current.start("prev"));
    act(() => vi.advanceTimersByTime(WEEK_FLIP_DELAY_MS / 2));
    act(() => result.current.start("next"));
    act(() => vi.advanceTimersByTime(WEEK_FLIP_DELAY_MS - 1));
    expect(push).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(push).toHaveBeenCalledExactlyOnceWith("/?week=2026-10-05", { scroll: false });
  });

  test("doesn't change week after the board unmounts", () => {
    const { result, unmount } = renderFlip();

    act(() => result.current.start("next"));
    unmount();
    act(() => vi.advanceTimersByTime(WEEK_FLIP_DELAY_MS));

    expect(push).not.toHaveBeenCalled();
  });
});
