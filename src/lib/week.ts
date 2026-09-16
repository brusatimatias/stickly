import { addWeeks, format, isValid, parseISO, startOfWeek, subWeeks } from "date-fns";

// Weeks start on Monday for the board.
const WEEK_STARTS_ON = 1;
const WEEK_PARAM_FORMAT = "yyyy-MM-dd";

export type WeekRange = { start: Date; end: Date };

/**
 * Returns the [start, end) range for the week containing `reference`.
 * `end` is exclusive (the start of the following week) to match the
 * `scheduledAt >= start AND scheduledAt < end` query pattern.
 */
export function getWeekRange(reference: Date): WeekRange {
  const start = startOfWeek(reference, { weekStartsOn: WEEK_STARTS_ON });
  const end = addWeeks(start, 1);
  return { start, end };
}

export function formatWeekParam(reference: Date): string {
  return format(
    startOfWeek(reference, { weekStartsOn: WEEK_STARTS_ON }),
    WEEK_PARAM_FORMAT
  );
}

/**
 * Parses a `week` query param (yyyy-MM-dd of any day in the week) back into
 * a Date. Falls back to the current week for missing or invalid input.
 */
export function parseWeekParam(param: string | undefined | null): Date {
  if (!param) return new Date();
  const parsed = parseISO(param);
  return isValid(parsed) ? parsed : new Date();
}

export function getAdjacentWeekStart(
  weekStart: Date,
  direction: "prev" | "next"
): Date {
  return direction === "prev" ? subWeeks(weekStart, 1) : addWeeks(weekStart, 1);
}
