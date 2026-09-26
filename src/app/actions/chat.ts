"use server";

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
import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { isSupportedLocale, DEFAULT_LOCALE } from "@/i18n/locales";
import { createNoteForUser } from "@/lib/noteCreation";
import {
  CREATE_NOTE_TOOL,
  LIST_NOTES_TOOL,
  parseListNotesInput,
  parseNoteToolInput,
} from "@/lib/noteInput";
import { listNotesForUser } from "@/lib/notes";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import {
  DAY_MS,
  DEFAULT_CHAT_MODEL,
  MINUTE_MS,
  buildChatSystemPrompt,
  getChatRateLimitError,
  getUserToday,
  sanitizeChatMessages,
} from "@/lib/webChat";

// Tool input errors the model can recover from (e.g. by asking for the date).
const RECOVERABLE_TOOL_ERRORS = new Set([
  "TITLE_REQUIRED",
  "DAY_REQUIRED",
  "INVALID_DAY",
  "INVALID_TIME",
  "INVALID_DATE_RANGE",
  "INVALID_NOTE_INPUT",
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

/**
 * Records this message and enforces the per-user and global limits over
 * rolling windows. Best-effort, without a lock: insert-then-count means
 * concurrent requests near a limit may all be rejected, but can't all slip
 * through. A rejected message doesn't count against the user.
 */
async function consumeChatQuota(userId: string) {
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

export async function sendChatMessage(input: { messages: unknown; timeZone: string }) {
  const userId = await requireUserId();
  const messages = sanitizeChatMessages(input.messages);
  await consumeChatQuota(userId);

  const requestLocale = await getLocale();
  const locale = isSupportedLocale(requestLocale) ? requestLocale : DEFAULT_LOCALE;
  const createdNotes: { id: string; day: string }[] = [];

  const createNote = tool({
    description: CREATE_NOTE_TOOL.description,
    inputSchema: toolSchema(CREATE_NOTE_TOOL.inputSchema),
    execute: async (args: unknown) => {
      try {
        const note = await createNoteForUser(userId, parseNoteToolInput(args));
        createdNotes.push(note);
        return { ok: true, day: note.day };
      } catch (error) {
        return toolErrorResult(CREATE_NOTE_TOOL.name, error, "NOTE_NOT_SAVED");
      }
    },
  });

  const listNotes = tool({
    description: LIST_NOTES_TOOL.description,
    inputSchema: toolSchema(LIST_NOTES_TOOL.inputSchema),
    execute: async (args: unknown) => {
      try {
        return { ok: true, ...(await listNotesForUser(userId, parseListNotesInput(args))) };
      } catch (error) {
        return toolErrorResult(LIST_NOTES_TOOL.name, error, "NOTES_UNAVAILABLE");
      }
    },
  });

  let reply: string;
  try {
    const result = await generateText({
      model: google(process.env.CHAT_MODEL || DEFAULT_CHAT_MODEL),
      system: buildChatSystemPrompt({ today: getUserToday(input.timeZone, new Date()), locale }),
      messages,
      tools: { [CREATE_NOTE_TOOL.name]: createNote, [LIST_NOTES_TOOL.name]: listNotes },
      stopWhen: isStepCount(MAX_STEPS),
      // A 429 won't clear up within a retry, and retries spend free-tier quota.
      maxRetries: 0,
    });
    reply = result.text.trim();
  } catch (error) {
    const apiError = RetryError.isInstance(error) ? error.lastError : error;
    if (APICallError.isInstance(apiError) && apiError.statusCode === 429) {
      throw new Error("CHAT_QUOTA_EXCEEDED");
    }
    console.error("[chat] generateText failed", error);
    throw new Error("CHAT_UNAVAILABLE");
  } finally {
    if (createdNotes.length > 0) {
      revalidatePath("/");
    }
  }

  return { reply, createdNotes };
}
