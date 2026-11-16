"use client";

import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useTransition } from "react";
import type { WeekDirection } from "@/components/board/BoardActionsContext";

/** How long a dragged note waits over a week arrow before the week changes. */
export const WEEK_FLIP_DELAY_MS = 700;

/**
 * Changes the board's week while a dragged note is held over a week arrow:
 * `start` when it reaches the arrow, `stop` when it leaves it or the drag
 * ends. After each change the next one waits for the new week to be shown
 * (plus the delay), so a slow response never skips a week. `isFlipping` is
 * true while a week is loading, when the days on screen are still the old ones.
 */
export function useWeekFlip({
  weekStart,
  prevWeekParam,
  nextWeekParam,
}: {
  /** The shown week's first day (yyyy-MM-dd); a new value means the week changed. */
  weekStart: string | undefined;
  prevWeekParam: string;
  nextWeekParam: string;
}) {
  const router = useRouter();
  const [isFlipping, startFlip] = useTransition();
  // Read when the timer fires: the params change with every week shown.
  const weekParamsRef = useRef({ prev: prevWeekParam, next: nextWeekParam });
  useEffect(() => {
    weekParamsRef.current = { prev: prevWeekParam, next: nextWeekParam };
  }, [prevWeekParam, nextWeekParam]);
  // The arrow being held, and its timer (null while the next week loads).
  const flipRef = useRef<{ direction: WeekDirection; timer: number | null } | null>(null);

  function schedule(direction: WeekDirection) {
    const timer = window.setTimeout(() => {
      if (flipRef.current) flipRef.current.timer = null;
      startFlip(() => {
        router.push(`/?week=${weekParamsRef.current[direction]}`, { scroll: false });
      });
    }, WEEK_FLIP_DELAY_MS);
    flipRef.current = { direction, timer };
  }

  function stop() {
    if (flipRef.current?.timer != null) window.clearTimeout(flipRef.current.timer);
    flipRef.current = null;
  }

  function start(direction: WeekDirection) {
    if (flipRef.current?.direction === direction) return;
    stop();
    schedule(direction);
  }

  // A new week is shown: if the note is still held over the arrow, wait again.
  const onWeekShown = useEffectEvent(() => {
    const flip = flipRef.current;
    if (flip && flip.timer === null) schedule(flip.direction);
  });
  useEffect(() => {
    onWeekShown();
  }, [weekStart]);

  useEffect(
    () => () => {
      if (flipRef.current?.timer != null) window.clearTimeout(flipRef.current.timer);
    },
    []
  );

  return { start, stop, isFlipping };
}
