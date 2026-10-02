import { dateToDay, dayToDate } from "@/lib/datetime";
import { MINUTE_MS } from "@/lib/time";

/**
 * A note's schedule is stored as `startsAt` + `kind` (see `NoteKind` in
 * schema.prisma):
 * - TIMED: an instant in UTC, shown in the viewer's time zone.
 * - ALL_DAY: a calendar day stored as its 00:00 UTC and read in UTC, never
 *   converted, so "Saturday" stays Saturday wherever the user is.
 *
 * This file is the only place that converts between the stored schedule and
 * the local day/time the user sees and types. It has no server imports, so
 * the board (a client component) uses it too.
 */
export type NoteKind = "TIMED" | "ALL_DAY";

export type StoredSchedule = { kind: NoteKind; startsAt: Date };

/** The day (yyyy-MM-dd) and time (HH:mm, null for ALL_DAY) as seen in a zone. */
export type LocalSchedule = { day: string; time: string | null };

/** Wire format of a stored schedule (server actions take plain strings). */
export type ScheduleInput = { kind: NoteKind; startsAt: string };

type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number };

function getZonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
  };
}

/** Minutes `timeZone` is ahead of UTC at `instant` (e.g. -180 for Buenos Aires). */
function getOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = getZonedParts(instant, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  return Math.round((asUtc - Math.floor(instant.getTime() / MINUTE_MS) * MINUTE_MS) / MINUTE_MS);
}

/**
 * The instant at which the clocks in `timeZone` read `day` `time`. For a time
 * skipped by a DST jump it lands just after the jump, as most calendars do.
 */
export function zonedTimeToUtc(day: string, time: string, timeZone: string): Date {
  const wallClock = new Date(`${day}T${time}:00.000Z`).getTime();
  const firstGuess = wallClock - getOffsetMinutes(new Date(wallClock), timeZone) * MINUTE_MS;
  // The offset at the guess can differ from the one at the wall-clock reading
  // near a DST change; a second pass settles it.
  return new Date(wallClock - getOffsetMinutes(new Date(firstGuess), timeZone) * MINUTE_MS);
}

/** Turns what the user typed in `timeZone` into the schedule to store. */
export function toStoredSchedule(day: string, time: string | null, timeZone: string): StoredSchedule {
  return time
    ? { kind: "TIMED", startsAt: zonedTimeToUtc(day, time, timeZone) }
    : { kind: "ALL_DAY", startsAt: dayToDate(day) };
}

/** Turns a stored schedule into the day and time to show in `timeZone`. */
export function toLocalSchedule(startsAt: Date, kind: NoteKind, timeZone: string): LocalSchedule {
  if (kind === "ALL_DAY") {
    return { day: dateToDay(startsAt), time: null };
  }
  const parts = getZonedParts(startsAt, timeZone);
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    day: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`,
    time: `${pad(parts.hour)}:${pad(parts.minute)}`,
  };
}

/**
 * Prisma `OR` conditions for the notes that fall on the local days
 * [fromDay, toDay) in `timeZone`: TIMED notes between the local midnights
 * converted to UTC, ALL_DAY notes between the days themselves. Used to query
 * a week or a single day.
 */
export function localDaysFilter(fromDay: string, toDay: string, timeZone: string) {
  return [
    {
      kind: "TIMED" as const,
      startsAt: {
        gte: zonedTimeToUtc(fromDay, "00:00", timeZone),
        lt: zonedTimeToUtc(toDay, "00:00", timeZone),
      },
    },
    { kind: "ALL_DAY" as const, startsAt: { gte: dayToDate(fromDay), lt: dayToDate(toDay) } },
  ];
}

const ISO_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

/** Validates a schedule coming from the client (untrusted). */
export function parseScheduleInput(input: unknown): StoredSchedule {
  const { kind, startsAt } = (input ?? {}) as Record<string, unknown>;
  if ((kind !== "TIMED" && kind !== "ALL_DAY") || typeof startsAt !== "string") {
    throw new Error("INVALID_SCHEDULE");
  }
  const instant = new Date(startsAt);
  // Date rolls impossible dates over (Feb 30 → Mar 2), so check it round-trips.
  if (
    !ISO_INSTANT_PATTERN.test(startsAt) ||
    Number.isNaN(instant.getTime()) ||
    instant.toISOString().slice(0, 19) !== startsAt.slice(0, 19)
  ) {
    throw new Error("INVALID_SCHEDULE");
  }
  if (kind === "ALL_DAY" && dayToDate(dateToDay(instant)).getTime() !== instant.getTime()) {
    throw new Error("INVALID_SCHEDULE");
  }
  return { kind, startsAt: instant };
}

/** Serializes a stored schedule for a server action call. */
export function toScheduleInput(schedule: StoredSchedule): ScheduleInput {
  return { kind: schedule.kind, startsAt: schedule.startsAt.toISOString() };
}
