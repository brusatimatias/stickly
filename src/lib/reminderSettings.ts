import { nextDay } from "@/lib/datetime";
import { HOUR_MS, MINUTE_MS } from "@/lib/time";
import { getTodayInZone } from "@/lib/timezone";
import { zonedTimeToUtc } from "@/lib/schedule";

/**
 * The user's reminder settings and when they fire. Pure (no server imports),
 * so the profile reads the options from here too.
 */

/** How long before a TIMED note its reminder can be set to fire, in minutes (0: at its time). */
export const REMINDER_LEAD_MINUTES = [0, 10, 15, 30, 60] as const;

/**
 * Reminders are queued (in QStash) for this window ahead; a daily cron queues
 * the next one, so it must be longer than a day plus the cron's slack.
 */
export const REMINDER_QUEUE_WINDOW_MS = 48 * HOUR_MS;

/** A reminder that arrives later than this (an outage, retries) is dropped instead. */
export const MAX_REMINDER_DELAY_MS = HOUR_MS;

export type ReminderSettings = {
  reminderMinutesBefore: number | null;
  digestEnabled: boolean;
  digestTime: string;
};

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Validates the settings sent by the profile (untrusted). */
export function parseReminderSettings(input: unknown): ReminderSettings {
  const { reminderMinutesBefore, digestEnabled, digestTime } = (input ?? {}) as Record<string, unknown>;
  if (
    !(reminderMinutesBefore === null || REMINDER_LEAD_MINUTES.includes(reminderMinutesBefore as never)) ||
    typeof digestEnabled !== "boolean" ||
    typeof digestTime !== "string" ||
    !TIME_PATTERN.test(digestTime)
  ) {
    throw new Error("INVALID_REMINDER_SETTINGS");
  }
  return { reminderMinutesBefore: reminderMinutesBefore as number | null, digestEnabled, digestTime };
}

/** When a TIMED note starting at `startsAt` is reminded. */
export function getNoteRemindAt(startsAt: Date, minutesBefore: number): Date {
  return new Date(startsAt.getTime() - minutesBefore * MINUTE_MS);
}

/** Whether a reminder due at `dueAt` should go out at `now`: not after its delay limit. */
export function isReminderStillUseful(dueAt: Date, now: Date): boolean {
  return now.getTime() - dueAt.getTime() <= MAX_REMINDER_DELAY_MS;
}

/** The instant of the digest for local `day`, at `digestTime` in `timeZone`. */
export function getDigestAt(day: string, digestTime: string, timeZone: string): Date {
  return zonedTimeToUtc(day, digestTime, timeZone);
}

/**
 * The digests due within [now, now + windowMs), as local days and instants.
 * Today's is included only if its time hasn't passed.
 */
export function getUpcomingDigests(
  digestTime: string,
  timeZone: string,
  now: Date,
  windowMs: number = REMINDER_QUEUE_WINDOW_MS
): { day: string; at: Date }[] {
  const digests = [];
  let day = getTodayInZone(timeZone, now);
  // The window spans at most a few local days.
  for (let i = 0; i < 4; i++, day = nextDay(day)) {
    const at = getDigestAt(day, digestTime, timeZone);
    if (at.getTime() >= now.getTime() && at.getTime() < now.getTime() + windowMs) {
      digests.push({ day, at });
    }
  }
  return digests;
}
