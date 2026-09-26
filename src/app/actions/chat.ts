"use server";

import { google } from "@ai-sdk/google";
import { APICallError, RetryError, generateText, isStepCount, jsonSchema, tool } from "ai";
import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { isSupportedLocale, DEFAULT_LOCALE } from "@/i18n/locales";
import { createNoteForUser } from "@/lib/noteCreation";
import { CREATE_NOTE_TOOL, parseNoteToolInput } from "@/lib/noteInput";
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
  "INVALID_NOTE_INPUT",
]);

// A tool call plus the final reply is 2 steps; the extra room covers a
// message that asks for more than one note.
const MAX_STEPS = 4;

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
    inputSchema: jsonSchema({
      ...CREATE_NOTE_TOOL.inputSchema,
      required: [...CREATE_NOTE_TOOL.inputSchema.required],
    }),
    execute: async (args: unknown) => {
      try {
        const note = await createNoteForUser(userId, parseNoteToolInput(args));
        createdNotes.push(note);
        return { ok: true, day: note.day };
      } catch (error) {
        if (error instanceof Error && RECOVERABLE_TOOL_ERRORS.has(error.message)) {
          return { ok: false, error: error.message };
        }
        // The SDK feeds anything thrown here back to the model verbatim, so
        // unexpected errors (e.g. Prisma's) must not escape: log them and hand
        // the model a generic code it can relay without leaking internals.
        console.error("[chat] create_note failed", error);
        return { ok: false, error: "NOTE_NOT_SAVED" };
      }
    },
  });

  let reply: string;
  try {
    const result = await generateText({
      model: google(process.env.CHAT_MODEL || DEFAULT_CHAT_MODEL),
      system: buildChatSystemPrompt({ today: getUserToday(input.timeZone, new Date()), locale }),
      messages,
      tools: { [CREATE_NOTE_TOOL.name]: createNote },
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
