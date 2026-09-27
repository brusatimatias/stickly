import { addDays, format, parseISO } from "date-fns";
import type { Locale } from "@/i18n/locales";
import { getTodayInZone, resolveTimeZone } from "@/lib/timezone";
import { getWeekRange } from "@/lib/week";

export const DEFAULT_CHAT_MODEL = "gemini-3.5-flash-lite";

export const MAX_MESSAGE_LENGTH = 500;
// Assistant turns come back from the client too, so they're capped as well,
// but truncated rather than rejected: the user didn't write them.
const MAX_ASSISTANT_MESSAGE_LENGTH = 1000;
// Only the most recent turns are sent to the model, to cap tokens per request.
const MAX_HISTORY_MESSAGES = 12;

/**
 * Sized for Gemini's free tier, whose quota is per API key (shared by every
 * user). Each chat message costs ~2 model requests (tool call + final reply),
 * so the global cap keeps us under Google's daily limit with some margin.
 */
export const CHAT_LIMITS = {
  userPerMinute: 5,
  userPerDay: 30,
  globalPerDay: 200,
} as const;

export const MINUTE_MS = 60_000;
export const DAY_MS = 24 * 60 * MINUTE_MS;

export type ChatMessage = { role: "user" | "assistant"; content: string };

/**
 * Validates the conversation sent by the client (untrusted) and keeps only
 * the latest turns. The history lives only in the browser, so this is the
 * single entry point for it.
 */
export function sanitizeChatMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("INVALID_CHAT_MESSAGES");
  }

  const messages = raw.slice(-MAX_HISTORY_MESSAGES).map((message): ChatMessage => {
    const { role, content } = (message ?? {}) as Record<string, unknown>;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") {
      throw new Error("INVALID_CHAT_MESSAGES");
    }
    const trimmed = content.trim();
    if (!trimmed) {
      throw new Error("INVALID_CHAT_MESSAGES");
    }
    if (role === "assistant") {
      return { role, content: trimmed.slice(0, MAX_ASSISTANT_MESSAGE_LENGTH) };
    }
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      throw new Error("CHAT_MESSAGE_TOO_LONG");
    }
    return { role, content: trimmed };
  });

  if (messages[messages.length - 1].role !== "user") {
    throw new Error("INVALID_CHAT_MESSAGES");
  }
  // The model API requires the conversation to start with a user turn.
  const firstUser = messages.findIndex((message) => message.role === "user");
  return messages.slice(firstUser);
}

export type UserToday = {
  date: string;
  weekday: string;
  timeZone: string;
  /** Monday and Sunday (yyyy-MM-dd) of the board week containing `date`. */
  weekStart: string;
  weekEnd: string;
};

/**
 * "Today" as seen by the user, so the model can resolve relative dates
 * ("tomorrow", "on Friday", "this week"). Falls back to UTC for an unknown
 * time zone.
 */
export function getUserToday(timeZone: string, now: Date): UserToday {
  const zone = resolveTimeZone(timeZone);
  const date = getTodayInZone(zone, now);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "long" }).format(now);
  const week = getWeekRange(parseISO(date));
  return {
    date,
    weekday,
    timeZone: zone,
    weekStart: format(week.start, "yyyy-MM-dd"),
    weekEnd: format(addDays(week.end, -1), "yyyy-MM-dd"),
  };
}

/** Returns the error code for the first exceeded limit, or null. Counts include the current message. */
export function getChatRateLimitError(counts: {
  userLastMinute: number;
  userLastDay: number;
  globalLastDay: number;
}): string | null {
  if (counts.userLastMinute > CHAT_LIMITS.userPerMinute) {
    return "CHAT_RATE_LIMITED";
  }
  if (counts.userLastDay > CHAT_LIMITS.userPerDay) {
    return "CHAT_DAILY_LIMIT_REACHED";
  }
  if (counts.globalLastDay > CHAT_LIMITS.globalPerDay) {
    return "CHAT_QUOTA_EXCEEDED";
  }
  return null;
}

const LANGUAGE_NAMES: Record<Locale, string> = { en: "English", es: "Spanish" };

export function buildChatSystemPrompt(context: {
  today: UserToday;
  locale: Locale;
}): string {
  const { today, locale } = context;
  return `You are the assistant of Stickly, a weekly board of sticky notes and reminders.
You help the user with their notes: you create notes with the create_note tool and answer questions about their notes with the list_notes tool.

Today is ${today.weekday} ${today.date} in the user's time zone (${today.timeZone}).
This week runs from Monday ${today.weekStart} to Sunday ${today.weekEnd}.
Resolve relative dates ("tomorrow", "on Friday", "next Monday", "next week") against it. A bare weekday means its next occurrence, today included.

Creating notes:
- Every note needs a day. If the user did not give a date, ask for it instead of guessing or calling the tool.
- Only set "time" when the user gave one, as 24h HH:mm ("6 pm" is 18:00).
- "title" is a short action ("Call the plumber"). Put any extra details in "description". Set "location" only when a place is mentioned.
- Write the note fields in the language the user wrote in.
- One tool call per note. If the user asks for several notes, create each one.
- After creating a note, confirm it in one short sentence including its day written naturally (e.g. "Friday, October 2"), and its time if any.

Answering about notes:
- Always call list_notes to answer; never answer from memory or from earlier messages, since notes change on the board.
- Pick the range from the question: "today" is from=to=today; "this week" is the week above; "tomorrow", a weekday or "next week" likewise.
- Use status "pending" for things not done yet ("what's left", "what do I have to do"), "done" for completed ones, and "all" otherwise.
- For a multi-day range, answer with one line per day in order, "Weekday: items", listing every day in the range, and "nothing" for days without notes. Start each line with a capital letter, separate several items in a day with commas, and put the time before the title when there is one.
- For a single day, list its items one per line, or say there is nothing.
- Use the note titles as they are. Mention location or description only if the user asks for details.

Errors and scope:
- If a tool returns an error, explain it briefly or ask for what is missing. NOTE_NOT_SAVED and NOTES_UNAVAILABLE mean a temporary problem: say so and suggest trying again.
- If the user asks for anything other than creating notes or asking about them, say briefly that you can only help with their notes.

Reply in ${LANGUAGE_NAMES[locale]} unless the user writes in another language, and translate weekday names to that language. Use plain text, no markdown.`;
}
