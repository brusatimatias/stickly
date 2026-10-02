import { google } from "@ai-sdk/google";
import {
  APICallError,
  RetryError,
  generateText,
  isStepCount,
  jsonSchema,
  tool,
  type JSONSchema7,
} from "ai";
import type { Locale } from "@/i18n/locales";
import { createDraftNoteForUser, createNoteForUser } from "@/lib/noteCreation";
import {
  CREATE_DRAFT_NOTE_TOOL,
  CREATE_NOTE_TOOL,
  LIST_NOTES_TOOL,
  parseDraftNoteToolInput,
  parseListNotesInput,
  parseNoteToolInput,
} from "@/lib/noteInput";
import { listNotesForUser } from "@/lib/notes";
import { prisma } from "@/lib/prisma";
import { toStoredSchedule } from "@/lib/schedule";
import { DAY_MS, MINUTE_MS } from "@/lib/time";
import {
  DEFAULT_CHAT_MODEL,
  buildChatSystemPrompt,
  getChatRateLimitError,
  getUserToday,
  type ChatMessage,
} from "@/lib/webChat";

// Tool input errors the model can recover from (e.g. by asking for the date).
const RECOVERABLE_TOOL_ERRORS = new Set([
  "TITLE_REQUIRED",
  "DAY_REQUIRED",
  "INVALID_DAY",
  "INVALID_TIME",
  "INVALID_DATE_RANGE",
  "INVALID_NOTE_INPUT",
  "DRAFT_LIMIT_REACHED",
]);

// A tool call plus the final reply is 2 steps; the extra room covers a
// message that asks for more than one note, or a lookup before creating.
const MAX_STEPS = 4;

/** The shared tool schemas are deeply readonly (`as const`); the SDK types them as a mutable JSONSchema7. */
function toolSchema(schema: object) {
  return jsonSchema(schema as JSONSchema7);
}

/**
 * Maps an error thrown while running a tool to the result the model sees.
 * The SDK feeds anything thrown from `execute` back to the model verbatim,
 * so unexpected errors (e.g. Prisma's) must not escape: they're logged and
 * replaced by a generic code the model can relay without leaking internals.
 */
function toolErrorResult(toolName: string, error: unknown, genericCode: string) {
  if (error instanceof Error && RECOVERABLE_TOOL_ERRORS.has(error.message)) {
    return { ok: false, error: error.message };
  }
  console.error(`[chat] ${toolName} failed`, error);
  return { ok: false, error: genericCode };
}

/** The HTTP status of a failed model call, if the provider answered with one. */
function providerStatusCode(error: unknown): number | undefined {
  const apiError = RetryError.isInstance(error) ? error.lastError : error;
  return APICallError.isInstance(apiError) ? apiError.statusCode : undefined;
}

/**
 * Records this message and enforces the per-user and global limits over
 * rolling windows. Best-effort, without a lock: insert-then-count means
 * concurrent requests near a limit may all be rejected, but can't all slip
 * through. A rejected message doesn't count against the user.
 */
export async function consumeChatQuota(userId: string) {
  const now = Date.now();
  const dayAgo = new Date(now - DAY_MS);

  await prisma.webChatUsage.deleteMany({ where: { createdAt: { lt: dayAgo } } });
  const usage = await prisma.webChatUsage.create({ data: { userId } });

  const [userLastMinute, userLastDay, globalLastDay] = await Promise.all([
    prisma.webChatUsage.count({ where: { userId, createdAt: { gte: new Date(now - MINUTE_MS) } } }),
    prisma.webChatUsage.count({ where: { userId, createdAt: { gte: dayAgo } } }),
    prisma.webChatUsage.count({ where: { createdAt: { gte: dayAgo } } }),
  ]);

  const limitError = getChatRateLimitError({ userLastMinute, userLastDay, globalLastDay });
  if (limitError) {
    await prisma.webChatUsage.deleteMany({ where: { id: usage.id, userId } });
    throw new Error(limitError);
  }
}

export type ChatTurn = {
  userId: string;
  /** Already sanitized, ending with the user's new message. */
  messages: ChatMessage[];
  /** The user's IANA zone: the model works with local days and times, converted to UTC here. */
  timeZone: string;
  /** The language to reply in, or null to reply in the one the user writes in (WhatsApp has no locale). */
  locale: Locale | null;
};

export type ChatTurnResult = {
  reply: string;
  /** `day` is null for drafts, which have no date. */
  createdNotes: { id: string; day: string | null }[];
};

/**
 * Runs one assistant turn: the model answers the conversation, creating or
 * listing the user's notes through the tools. Shared by every chat channel,
 * which authenticate the user, sanitize the conversation and consume the
 * quota before calling it. Revalidating the board when notes were created is
 * also up to the caller.
 * Throws `CHAT_QUOTA_EXCEEDED` or `CHAT_UNAVAILABLE` when the model fails
 * before saving anything.
 */
export async function runChatTurn({
  userId,
  messages,
  timeZone,
  locale,
}: ChatTurn): Promise<ChatTurnResult> {
  const createdNotes: ChatTurnResult["createdNotes"] = [];

  const createNote = tool({
    description: CREATE_NOTE_TOOL.description,
    inputSchema: toolSchema(CREATE_NOTE_TOOL.inputSchema),
    execute: async (args: unknown) => {
      try {
        const { day, time, ...fields } = parseNoteToolInput(args);
        const note = await createNoteForUser(userId, {
          ...fields,
          schedule: toStoredSchedule(day, time || null, timeZone),
        });
        createdNotes.push({ id: note.id, day });
        return { ok: true, day };
      } catch (error) {
        return toolErrorResult(CREATE_NOTE_TOOL.name, error, "NOTE_NOT_SAVED");
      }
    },
  });

  const createDraftNote = tool({
    description: CREATE_DRAFT_NOTE_TOOL.description,
    inputSchema: toolSchema(CREATE_DRAFT_NOTE_TOOL.inputSchema),
    execute: async (args: unknown) => {
      try {
        const note = await createDraftNoteForUser(userId, parseDraftNoteToolInput(args));
        createdNotes.push({ id: note.id, day: null });
        return { ok: true };
      } catch (error) {
        return toolErrorResult(CREATE_DRAFT_NOTE_TOOL.name, error, "NOTE_NOT_SAVED");
      }
    },
  });

  const listNotes = tool({
    description: LIST_NOTES_TOOL.description,
    inputSchema: toolSchema(LIST_NOTES_TOOL.inputSchema),
    execute: async (args: unknown) => {
      try {
        return { ok: true, ...(await listNotesForUser(userId, parseListNotesInput(args), timeZone)) };
      } catch (error) {
        return toolErrorResult(LIST_NOTES_TOOL.name, error, "NOTES_UNAVAILABLE");
      }
    },
  });

  const generate = (modelId: string) =>
    generateText({
      model: google(modelId),
      system: buildChatSystemPrompt({ today: getUserToday(timeZone, new Date()), locale }),
      messages,
      tools: {
        [CREATE_NOTE_TOOL.name]: createNote,
        [CREATE_DRAFT_NOTE_TOOL.name]: createDraftNote,
        [LIST_NOTES_TOOL.name]: listNotes,
      },
      stopWhen: isStepCount(MAX_STEPS),
      // A 429 won't clear up within a retry, and retries spend free-tier quota.
      maxRetries: 0,
    });

  let reply: string;
  try {
    let result: Awaited<ReturnType<typeof generate>>;
    try {
      result = await generate(process.env.CHAT_MODEL || DEFAULT_CHAT_MODEL);
    } catch (error) {
      // A 503 ("high demand") is the model being overloaded, so retrying the
      // same one is poor; another model usually answers. Not once a note was
      // saved, though: the retry would create it again.
      const fallbackModel = process.env.CHAT_FALLBACK_MODEL;
      if (!fallbackModel || createdNotes.length > 0 || providerStatusCode(error) !== 503) {
        throw error;
      }
      console.warn("[chat] model unavailable, retrying with the fallback model", error);
      result = await generate(fallbackModel);
    }
    reply = result.text.trim();
  } catch (error) {
    if (createdNotes.length > 0) {
      // The notes are saved, so this is a success without a reply (the
      // channel shows a generic confirmation). An error would make the user
      // resend the message and duplicate them.
      console.error("[chat] generateText failed after saving notes", error);
      reply = "";
    } else if (providerStatusCode(error) === 429) {
      throw new Error("CHAT_QUOTA_EXCEEDED");
    } else {
      console.error("[chat] generateText failed", error);
      throw new Error("CHAT_UNAVAILABLE");
    }
  }

  return { reply, createdNotes };
}
