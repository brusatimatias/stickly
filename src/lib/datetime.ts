/**
 * Calendar days (ALL_DAY notes, see src/lib/schedule.ts) are stored as a
 * `Date` at 00:00 UTC. These helpers convert between that and the
 * `yyyy-MM-dd` strings used everywhere else, always in UTC so the result
 * doesn't depend on the server's time zone.
 */
export function dayToDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

export function dateToDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The day after `day` (yyyy-MM-dd), independent of the server's time zone. */
export function nextDay(day: string): string {
  return dateToDay(new Date(dayToDate(day).getTime() + 24 * 60 * 60 * 1000));
}
