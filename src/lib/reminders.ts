import { after } from "next/server";
import { nextDay } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";
import { isQStashConfigured, queueReminders, type QueuedReminder } from "@/lib/qstash";
import {
  getDigestAt,
  getNoteRemindAt,
  getUpcomingDigests,
  isReminderStillUseful,
  REMINDER_QUEUE_WINDOW_MS,
} from "@/lib/reminderSettings";
import { localDaysFilter, toLocalSchedule } from "@/lib/schedule";
import { resolveTimeZone } from "@/lib/timezone";
import { getNotificationTranslator, sendPushNotification, type PushPayload } from "@/lib/webPush";

/**
 * Note reminders and the daily digest, as push notifications.
 *
 * Queueing: each reminder becomes a QStash message delivered at its time.
 * Only the next 48 h are queued (QStash's free plan can't delay longer than a
 * week); a daily cron queues each new window, and saving a note or the
 * settings queues what changed right away. Queueing never cancels anything:
 * a message that no longer applies (the note moved, was done or deleted, the
 * settings changed) is recognized and dropped when it's delivered.
 *
 * Delivering: the message is checked against the database, claimed (so a
 * duplicate or retried delivery doesn't push twice) and pushed to every
 * device of the user.
 *
 * Kept out of "use server" files: these take a user id, not a session.
 */

export type ReminderMessage =
  | { type: "note"; noteId: string; remindAt: string }
  | { type: "digest"; userId: string; day: string; at: string };

const MAX_ID_LENGTH = 64;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_ID_LENGTH;
}

function isInstant(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime());
}

/** Validates a delivered message's body (signed by QStash, but checked anyway). */
export function parseReminderMessage(input: unknown): ReminderMessage | null {
  const message = (input ?? {}) as Record<string, unknown>;
  if (message.type === "note" && isId(message.noteId) && isInstant(message.remindAt)) {
    return { type: "note", noteId: message.noteId, remindAt: message.remindAt };
  }
  if (
    message.type === "digest" &&
    isId(message.userId) &&
    typeof message.day === "string" &&
    DAY_PATTERN.test(message.day) &&
    isInstant(message.at)
  ) {
    return { type: "digest", userId: message.userId, day: message.day, at: message.at };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Queueing

type QueueUser = {
  id: string;
  timeZone: string | null;
  reminderMinutesBefore: number | null;
  digestEnabled: boolean;
  digestTime: string;
};

const QUEUE_USER_SELECT = {
  id: true,
  timeZone: true,
  reminderMinutesBefore: true,
  digestEnabled: true,
  digestTime: true,
} as const;

function isInQueueWindow(instant: Date, now: Date): boolean {
  return instant.getTime() >= now.getTime() && instant.getTime() < now.getTime() + REMINDER_QUEUE_WINDOW_MS;
}

function noteReminder(noteId: string, startsAt: Date, minutesBefore: number, now: Date): QueuedReminder | null {
  const remindAt = getNoteRemindAt(startsAt, minutesBefore);
  if (!isInQueueWindow(remindAt, now)) return null;
  const body: ReminderMessage = { type: "note", noteId, remindAt: remindAt.toISOString() };
  return { body, notBefore: remindAt, deduplicationId: `note-${noteId}-${remindAt.getTime()}` };
}

function digestReminders(user: QueueUser, now: Date): QueuedReminder[] {
  const timeZone = resolveTimeZone(user.timeZone);
  return getUpcomingDigests(user.digestTime, timeZone, now).map(({ day, at }) => {
    const body: ReminderMessage = { type: "digest", userId: user.id, day, at: at.toISOString() };
    return { body, notBefore: at, deduplicationId: `digest-${user.id}-${day}-${at.getTime()}` };
  });
}

/** Everything of one user due in the next window. */
async function remindersForUser(user: QueueUser, now: Date): Promise<QueuedReminder[]> {
  const reminders: QueuedReminder[] = [];
  if (user.reminderMinutesBefore !== null) {
    const lead = user.reminderMinutesBefore * 60_000;
    const notes = await prisma.note.findMany({
      where: {
        userId: user.id,
        isDraft: false,
        isDone: false,
        kind: "TIMED",
        startsAt: {
          gte: new Date(now.getTime() + lead),
          lt: new Date(now.getTime() + REMINDER_QUEUE_WINDOW_MS + lead),
        },
      },
      select: { id: true, startsAt: true },
    });
    for (const note of notes) {
      const reminder = noteReminder(note.id, note.startsAt!, user.reminderMinutesBefore, now);
      if (reminder) reminders.push(reminder);
    }
  }
  if (user.digestEnabled) {
    reminders.push(...digestReminders(user, now));
  }
  return reminders;
}

/** Users who would get something: reminders or digest on, and a device to send it to. */
const HAS_REMINDERS_ON = {
  OR: [{ reminderMinutesBefore: { not: null } }, { digestEnabled: true }],
  pushSubscriptions: { some: {} },
};

/** Queues a user's reminders and digests after their settings or devices change. Never throws. */
export async function queueUserReminders(userId: string, now: Date = new Date()): Promise<void> {
  if (!isQStashConfigured()) return;
  try {
    const user = await prisma.user.findFirst({
      where: { id: userId, ...HAS_REMINDERS_ON },
      select: QUEUE_USER_SELECT,
    });
    if (user) await queueReminders(await remindersForUser(user, now));
  } catch (error) {
    console.error(`[reminders] couldn't queue the reminders of user ${userId}`, error);
  }
}

/**
 * The daily cron: queues the next window for every user. Reads them all
 * first, then publishes in batches, so it stays well within the function's
 * time limit.
 */
export async function queueAllReminders(now: Date = new Date()): Promise<{ users: number; queued: number }> {
  const users = await prisma.user.findMany({
    where: HAS_REMINDERS_ON,
    select: QUEUE_USER_SELECT,
    orderBy: { id: "asc" },
  });
  const reminders: QueuedReminder[] = [];
  for (const user of users) {
    try {
      reminders.push(...(await remindersForUser(user, now)));
    } catch (error) {
      // One user's failure shouldn't leave everyone else without reminders.
      console.error(`[reminders] couldn't read the reminders of user ${user.id}`, error);
    }
  }
  await queueReminders(reminders);
  return { users: users.length, queued: reminders.length };
}

/**
 * Queues a note's reminder, if it gets one soon. Never throws. Looks the note
 * up by id alone: callers have already checked it belongs to the session's
 * user.
 */
export async function queueNoteReminder(noteId: string, now: Date = new Date()): Promise<void> {
  if (!isQStashConfigured()) return;
  try {
    const note = await prisma.note.findFirst({
      where: { id: noteId, isDraft: false, isDone: false, kind: "TIMED", user: HAS_REMINDERS_ON },
      select: { id: true, startsAt: true, user: { select: { reminderMinutesBefore: true } } },
    });
    const reminder =
      note?.startsAt && note.user.reminderMinutesBefore !== null
        ? noteReminder(note.id, note.startsAt, note.user.reminderMinutesBefore, now)
        : null;
    if (reminder) await queueReminders([reminder]);
  } catch (error) {
    console.error(`[reminders] couldn't queue the reminder of note ${noteId}`, error);
  }
}

/** `queueNoteReminder` once the response is sent, so saving a note doesn't wait on QStash. */
export function queueNoteReminderAfterResponse(noteId: string): void {
  after(() => queueNoteReminder(noteId));
}

// ---------------------------------------------------------------------------
// Delivering

type Subscription = { id: string; endpoint: string; p256dh: string; auth: string; locale: string };

const SUBSCRIPTION_SELECT = { id: true, endpoint: true, p256dh: true, auth: true, locale: true } as const;

// The digest is useful for a few hours; a reminder until its note starts.
const DIGEST_TTL_SECONDS = 3 * 60 * 60;
const MIN_TTL_SECONDS = 60;
const MAX_DIGEST_LINES = 5;

function formatTime(instant: Date, locale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, { timeStyle: "short", timeZone }).format(instant);
}

async function pushToAll(
  subscriptions: Subscription[],
  buildPayload: (locale: string) => PushPayload,
  options: { ttlSeconds: number; urgency: "normal" | "high" }
) {
  await Promise.all(
    subscriptions.map((subscription) =>
      sendPushNotification(subscription, buildPayload(subscription.locale), options)
    )
  );
}

async function deliverNoteReminder(
  message: Extract<ReminderMessage, { type: "note" }>,
  now: Date
): Promise<"sent" | "skipped"> {
  const remindAt = new Date(message.remindAt);
  const note = await prisma.note.findUnique({
    where: { id: message.noteId },
    select: {
      id: true,
      title: true,
      location: true,
      kind: true,
      startsAt: true,
      isDraft: true,
      isDone: true,
      user: {
        select: {
          timeZone: true,
          reminderMinutesBefore: true,
          pushSubscriptions: { select: SUBSCRIPTION_SELECT },
        },
      },
    },
  });
  const minutesBefore = note?.user.reminderMinutesBefore;
  if (
    !note?.startsAt ||
    note.kind !== "TIMED" ||
    note.isDraft ||
    note.isDone ||
    minutesBefore === null ||
    minutesBefore === undefined ||
    // The note's time or the lead time changed since it was queued.
    getNoteRemindAt(note.startsAt, minutesBefore).getTime() !== remindAt.getTime() ||
    !isReminderStillUseful(remindAt, now) ||
    note.user.pushSubscriptions.length === 0
  ) {
    return "skipped";
  }

  // Claimed before sending: a duplicate delivery finds it taken. If sending
  // then fails, the reminder is lost rather than risking it twice.
  const claimed = await prisma.note.updateMany({
    where: { id: note.id, OR: [{ reminderSentFor: null }, { reminderSentFor: { not: remindAt } }] },
    data: { reminderSentFor: remindAt },
  });
  if (claimed.count === 0) return "skipped";

  const timeZone = resolveTimeZone(note.user.timeZone);
  const startsAt = note.startsAt;
  const { day } = toLocalSchedule(startsAt, "TIMED", timeZone);
  await pushToAll(
    note.user.pushSubscriptions,
    (locale) => {
      const t = getNotificationTranslator(locale);
      const time = formatTime(startsAt, locale, timeZone);
      const when =
        minutesBefore === 0
          ? t("startsNow", { time })
          : minutesBefore >= 60
            ? t("startsInHours", { hours: minutesBefore / 60, time })
            : t("startsInMinutes", { minutes: minutesBefore, time });
      return {
        title: note.title,
        body: note.location ? `${when} · ${note.location}` : when,
        url: `/?week=${day}`,
        tag: `note-${note.id}`,
      };
    },
    {
      ttlSeconds: Math.max(MIN_TTL_SECONDS, Math.round((startsAt.getTime() - now.getTime()) / 1000)),
      urgency: "high",
    }
  );
  return "sent";
}

async function deliverDigest(
  message: Extract<ReminderMessage, { type: "digest" }>,
  now: Date
): Promise<"sent" | "skipped"> {
  const at = new Date(message.at);
  const user = await prisma.user.findUnique({
    where: { id: message.userId },
    select: {
      id: true,
      timeZone: true,
      digestEnabled: true,
      digestTime: true,
      pushSubscriptions: { select: SUBSCRIPTION_SELECT },
    },
  });
  if (!user?.digestEnabled || user.pushSubscriptions.length === 0) return "skipped";
  const timeZone = resolveTimeZone(user.timeZone);
  // The digest time or the user's zone changed since it was queued.
  if (getDigestAt(message.day, user.digestTime, timeZone).getTime() !== at.getTime()) return "skipped";
  if (!isReminderStillUseful(at, now)) return "skipped";

  const claimed = await prisma.user.updateMany({
    where: { id: user.id, OR: [{ digestSentOn: null }, { digestSentOn: { not: message.day } }] },
    data: { digestSentOn: message.day },
  });
  if (claimed.count === 0) return "skipped";

  const notes = await prisma.note.findMany({
    where: { userId: user.id, isDraft: false, isDone: false, OR: localDaysFilter(message.day, nextDay(message.day), timeZone) },
    select: { title: true, kind: true, startsAt: true },
  });
  // Nothing pending: no notification rather than an empty one.
  if (notes.length === 0) return "skipped";

  // All-day notes first, then by time.
  const ordered = [...notes].sort(
    (a, b) =>
      Number(a.kind === "TIMED") - Number(b.kind === "TIMED") || a.startsAt!.getTime() - b.startsAt!.getTime()
  );
  await pushToAll(
    user.pushSubscriptions,
    (locale) => {
      const t = getNotificationTranslator(locale);
      const lines = ordered
        .slice(0, MAX_DIGEST_LINES)
        .map((note) =>
          note.kind === "TIMED" ? `${formatTime(note.startsAt!, locale, timeZone)} ${note.title}` : note.title
        );
      if (ordered.length > MAX_DIGEST_LINES) {
        lines.push(t("digestMore", { count: ordered.length - MAX_DIGEST_LINES }));
      }
      return {
        title: t("digestTitle", { count: ordered.length }),
        body: lines.join("\n"),
        url: `/?week=${message.day}`,
        tag: `digest-${message.day}`,
      };
    },
    { ttlSeconds: DIGEST_TTL_SECONDS, urgency: "normal" }
  );
  return "sent";
}

/** Delivers a queued reminder, or skips it if it no longer applies. */
export async function deliverReminder(message: ReminderMessage, now: Date = new Date()): Promise<"sent" | "skipped"> {
  return message.type === "note" ? deliverNoteReminder(message, now) : deliverDigest(message, now);
}
