import { addDays, format, parseISO } from "date-fns";
import type { Locale } from "@/i18n/locales";
import { MAX_DRAFT_NOTES, TITLE_SOFT_LIMIT } from "@/lib/noteInput";
import { getTodayInZone, resolveTimeZone } from "@/lib/timezone";
import { getWeekRange } from "@/lib/week";

export const DEFAULT_CHAT_MODEL = "gemini-3.5-flash-lite";

export const MAX_MESSAGE_LENGTH = 500;
// Assistant turns come back from the client too, so they're capped as well,
// but truncated rather than rejected: the user didn't write them.
export const MAX_ASSISTANT_MESSAGE_LENGTH = 1000;
// Only the most recent turns are sent to the model, to cap tokens per request.
export const MAX_HISTORY_MESSAGES = 12;

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

/**
 * Cuts a reply to `max` characters at the last line break, so a long list
 * loses whole notes rather than ending mid-sentence. Falls back to a hard cut
 * when there's no line break in the second half.
 */
export function truncateReply(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  const lineEnd = text.lastIndexOf("\n", max - 2);
  if (lineEnd > max / 2) {
    return `${text.slice(0, lineEnd).trimEnd()}\n…`;
  }
  return `${text.slice(0, max - 1)}…`;
}

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

function replyLanguage(locale: Locale | null): string {
  if (!locale) {
    return "Reply in the language the user writes in, and write weekday names in that language.";
  }
  return `Reply in ${LANGUAGE_NAMES[locale]} unless the user writes in another language, and translate weekday names to that language.`;
}

export function buildChatSystemPrompt(context: {
  today: UserToday;
  /** Null when the channel has no locale (WhatsApp): reply in the user's language. */
  locale: Locale | null;
}): string {
  const { today, locale } = context;
  return `You are the assistant of Stickly, a weekly board of sticky notes and reminders.
You help the user with their notes: you create notes with the create_note tool, draft notes (only when asked for a draft) with the create_draft_note tool, and answer questions about their notes with the list_notes tool.

Today is ${today.weekday} ${today.date} in the user's time zone (${today.timeZone}).
This week runs from Monday ${today.weekStart} to Sunday ${today.weekEnd}.
Resolve relative dates ("tomorrow", "on Friday", "next Monday", "next week") against it. A bare weekday means its next occurrence, today included: "${today.weekday}" on its own means today, ${today.date}, not next week.

Creating notes:
- Every note needs a day. If the user did not give a date, ask for it instead of guessing or calling the tool.
- Only when the user explicitly asks for a draft (e.g. "save this as a draft", "anotame como borrador ..."), create it with create_draft_note instead. Never use it just because the date is missing: ask for the date. They can keep at most ${MAX_DRAFT_NOTES} drafts: if the tool answers DRAFT_LIMIT_REACHED, tell them to schedule or delete a draft first.
- Only set "time" when the user gave one, as 24h HH:mm ("6 pm" is 18:00). A part of the day ("a la noche", "por la tarde", "in the morning") is not a time: leave "time" out and keep those words in the description.
- "title" is 2 to 6 words (at most ${TITLE_SOFT_LIMIT} characters), starting with a verb or the key noun, capitalized: "Call the plumber", "Dentist appointment". Keep what or who it is about (a person, a project, a product), since that's what identifies the note. That includes Stickly itself: a note can be a task about the app (e.g. "revisar el login en Stickly" → "Revisar login en Stickly").
- Never put the day, time or place in the title: they have their own fields. Leave out filler such as "remind me to", "don't forget to", "recordame", "tengo que", "no olvidarme de".
- Put every other detail the user gave in "description" (who, what to bring, amounts, phone numbers, names, the reason, what exactly to check), as a short phrase starting with a capital letter. Shorten it only by dropping filler and what's already in the title, day, time or location: never drop or reinterpret a detail, never add one (don't call something an error if the user didn't), and keep the user's own words for names and terms, even ones in another language. Omit "description" when nothing is left.
- Set "location" only when a place is mentioned.
- Examples, only to show the shape (message → fields); always write the fields in the user's own language:
  "Recordame que el martes tengo que llevar el auto al mecánico porque hace ruido el freno" → title "Llevar el auto al mecánico", description "Hace ruido el freno"
  "mañana 18hs clase de yoga en Av. Corrientes 800, llevar la colchoneta" → title "Clase de yoga", location "Av. Corrientes 800", time 18:00, description "Llevar la colchoneta"
  "Don't let me forget to renew my passport on Monday, the appointment number is 4471" → title "Renew passport", description "Appointment number 4471"
  "buy stamps on thursday" → title "Buy stamps", no description
  "hoy revisar en el proyecto X qué pasa si el usuario borra la cuenta con el sync on" → title "Revisar borrado de cuenta en X", description "Qué pasa si el usuario borra la cuenta con el sync on"
- Write the note fields in the language the user wrote in.
- One tool call per note. If the user asks for several notes, create each one.
- After creating a note, confirm it in one short sentence including its day written naturally (e.g. "Friday, October 2"), and its time if any. For a draft, say it's in the draft panel.

Answering about notes:
- Always call list_notes to answer; never answer from memory or from earlier messages, since notes change on the board.
- Pick the range from the question: "today" is from=to=today; "this week" is the week above; "tomorrow", a weekday or "next week" likewise.
- Use status "pending" for things not done yet ("what's left", "what do I have to do"), "done" for completed ones ("what did I do", "qué hice", "qué terminé"), and "all" otherwise.
- For a multi-day range, answer with one line per day in order, "Weekday: items", listing every day in the range, and "nothing" for days without notes. Start each line with a capital letter, separate several items in a day with commas, and put the time before the title when there is one.
- For a single day, show each note's details. Start with one short line saying how many notes there are (e.g. "Hoy tenés 3 pendientes:"), then a blank line, then one block per note with a blank line between blocks. A block is the time (if any) and the title on the first line; below it, each on its own line starting with "- " (no indentation), "- En: <location>" (the word "En" in the reply language, e.g. "- At:") if it has a location, and "- <description>" if it has one, shortened to one sentence of at most about 120 characters if longer. A description with several lines keeps one line per line: lines that already start with a marker ("-", "•", "*", "1.") stay as they are, never with a second "- ", and every unmarked line gets "- ", not just the first (e.g. "Sacar el seguro\nComprar adaptador" → "- Sacar el seguro" and "- Comprar adaptador" on two lines). When listing both pending and done notes, add "(hecha)" after the title of a done one (in the reply language, e.g. "(done)"). If there are no notes, say so in one line.
- Use the note titles as they are. In a multi-day answer, mention location or description only if the user asks for details.

Errors and scope:
- If a tool returns an error, explain it briefly or ask for what is missing. NOTE_NOT_SAVED and NOTES_UNAVAILABLE mean a temporary problem: say so and suggest trying again.
- If the user asks for anything other than creating notes or asking about them, say briefly that you can only help with their notes.

${replyLanguage(locale)} Use plain text, no markdown.`;
}
