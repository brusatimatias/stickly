/**
 * Note dates are calendar days stored in a Postgres `DATE` column, which
 * Prisma reads and writes as a `Date` at 00:00 UTC. These helpers convert
 * between that and the `yyyy-MM-dd` strings used everywhere else, always in
 * UTC so the result doesn't depend on the server's time zone.
 */
export function dayToDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

export function dateToDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * The wall-clock `yyyy-MM-ddTHH:mm:00` that is `minutes` after `day` + `time`
 * (both as written, no time zone), rolling over to the next day if needed.
 * Used to build Calendar events, which pair these with the user's time zone.
 */
export function localDateTime(day: string, time: string, minutes = 0): string {
  const [hours, mins] = time.split(":").map(Number);
  const shifted = new Date(dayToDate(day).getTime() + (hours * 60 + mins + minutes) * 60_000);
  return shifted.toISOString().slice(0, 19);
}
