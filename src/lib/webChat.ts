import type { Locale } from "@/i18n/locales";

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

/**
 * "Today" as seen by the user, so the model can resolve relative dates
 * ("tomorrow", "on Friday"). Falls back to UTC for an unknown time zone.
 */
export function getUserToday(timeZone: string, now: Date): { date: string; weekday: string; timeZone: string } {
  let zone = timeZone;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
  } catch {
    zone = "UTC";
  }
  // en-CA formats dates as yyyy-MM-dd.
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(now);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "long" }).format(now);
  return { date, weekday, timeZone: zone };
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
  today: { date: string; weekday: string; timeZone: string };
  locale: Locale;
}): string {
  const { today, locale } = context;
  return `You are the assistant of Stickly, a weekly board of sticky notes and reminders.
Your only job is to turn what the user asks into notes using the create_note tool.

Today is ${today.weekday} ${today.date} in the user's time zone (${today.timeZone}).
Resolve relative dates ("tomorrow", "on Friday", "next Monday") against it. A bare weekday means its next occurrence, today included.

Rules:
- Every note needs a day. If the user did not give a date, ask for it instead of guessing or calling the tool.
- Only set "time" when the user gave one, as 24h HH:mm ("6 pm" is 18:00).
- "title" is a short action ("Call the plumber"). Put any extra details in "description". Set "location" only when a place is mentioned.
- Write the note fields in the language the user wrote in.
- One tool call per note. If the user asks for several notes, create each one.
- If the tool returns an error, explain it briefly or ask for what is missing. NOTE_NOT_SAVED means a temporary problem: say the note could not be saved and suggest trying again.
- After creating a note, confirm it in one short sentence including its day written naturally (e.g. "Friday, October 2"), and its time if any.
- If the user asks for anything other than creating notes, say briefly that you can only create notes.

Reply in ${LANGUAGE_NAMES[locale]} unless the user writes in another language. Use plain text, no markdown.`;
}
