import { parseISO } from "date-fns";

/** Combines a `yyyy-MM-dd` day and an `HH:mm` time into a single Date. */
export function combineDayAndTime(day: string, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const date = parseISO(day);
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
}
