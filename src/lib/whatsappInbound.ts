import { consumeChatQuota, runChatTurn } from "@/lib/chatAssistant";
import { prisma } from "@/lib/prisma";
import { resolveTimeZone } from "@/lib/timezone";
import {
  MAX_ASSISTANT_MESSAGE_LENGTH,
  MAX_HISTORY_MESSAGES as MAX_SENT_MESSAGES,
  sanitizeChatMessages,
  type ChatMessage,
} from "@/lib/webChat";
import { sendWhatsAppText } from "@/lib/whatsappApi";
import { hashLinkCode, parseLinkCode } from "@/lib/whatsappLink";
import type { InboundMessage } from "@/lib/whatsappWebhook";

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;

/** A conversation idle for this long starts over, so an old question isn't picked up again. */
export const HISTORY_IDLE_MS = 30 * 60_000;
/**
 * Earlier turns sent to the model with each new message. Plus the new one it
 * must stay within what `sanitizeChatMessages` keeps, or it'd drop turns.
 */
export const MAX_HISTORY_MESSAGES = Math.min(10, MAX_SENT_MESSAGES - 1);

/**
 * Link code guesses allowed per number and hour. A code is one of a million
 * and lives ten minutes, so this keeps guessing someone else's hopeless from
 * one number. It's per number, not global: spreading guesses over many real
 * WhatsApp numbers isn't covered, which the short lifetime makes impractical.
 */
export const MAX_LINK_ATTEMPTS_PER_HOUR = 5;

// Fixed replies, sent without calling the model. WhatsApp has no locale to go
// by (and an unlinked number has no user), so they're in both languages.
export const WHATSAPP_REPLIES = {
  notLinked:
    "Este número no está vinculado a Stickly. Generá un código en tu perfil y enviámelo por acá.\n\nThis number isn't linked to Stickly. Get a code on your profile and send it here.",
  linked:
    "¡Listo! Tu número quedó vinculado. Escribime lo que quieras anotar.\n\nDone! Your number is linked. Tell me what to write down.",
  invalidCode:
    "Ese código no es válido o ya venció. Generá uno nuevo en tu perfil.\n\nThat code is invalid or expired. Get a new one on your profile.",
  tooManyAttempts:
    "Demasiados intentos. Probá de nuevo en una hora.\n\nToo many attempts. Try again in an hour.",
  textOnly: "Por ahora solo leo mensajes de texto.\n\nFor now I can only read text messages.",
  noteCreated: "Listo, anotado en tu tablero.\n\nDone, it's on your board.",
  noReply: "No pude responder eso. Probá reformularlo.\n\nI couldn't answer that. Try rephrasing it.",
  tooLong: "El mensaje es muy largo. Probá con uno más corto.\n\nThat message is too long. Try a shorter one.",
  rateLimited:
    "Estás enviando mensajes muy rápido. Esperá un minuto.\n\nYou're sending messages too fast. Wait a minute.",
  dailyLimit:
    "Llegaste al límite de mensajes de hoy. Probá mañana.\n\nYou've reached today's message limit. Try again tomorrow.",
  unavailable:
    "El asistente no está disponible ahora. Probá en un rato.\n\nThe assistant isn't available right now. Try again later.",
} as const;

// Chat error codes and the reply for each; anything else gets `unavailable`.
const CHAT_ERROR_REPLIES: Record<string, string> = {
  CHAT_MESSAGE_TOO_LONG: WHATSAPP_REPLIES.tooLong,
  CHAT_RATE_LIMITED: WHATSAPP_REPLIES.rateLimited,
  CHAT_DAILY_LIMIT_REACHED: WHATSAPP_REPLIES.dailyLimit,
  CHAT_QUOTA_EXCEEDED: WHATSAPP_REPLIES.unavailable,
  CHAT_UNAVAILABLE: WHATSAPP_REPLIES.unavailable,
};

/**
 * Records the message id and returns false if it was already recorded:
 * Meta delivers at least once, so the same message can arrive twice.
 * Recorded before handling on purpose: if handling then fails, the message is
 * lost rather than retried (Meta already got its 200 anyway), but a message is
 * never handled twice, which could create a note twice.
 */
async function recordInbound(message: InboundMessage, isLinkAttempt: boolean): Promise<boolean> {
  await prisma.whatsAppInboundMessage.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - DAY_MS) } },
  });
  try {
    await prisma.whatsAppInboundMessage.create({
      data: { wamid: message.wamid, from: message.from, isLinkAttempt },
    });
    return true;
  } catch (error) {
    if ((error as { code?: unknown } | null)?.code === "P2002") {
      return false;
    }
    throw error;
  }
}

/**
 * Links `from` to the user whose pending code this is. A number belongs to
 * one user, so if it was linked to someone else it moves; both users'
 * WhatsApp conversations are dropped, as they start over.
 */
async function linkNumber(from: string, code: string): Promise<string> {
  const attempts = await prisma.whatsAppInboundMessage.count({
    where: { from, isLinkAttempt: true, createdAt: { gte: new Date(Date.now() - HOUR_MS) } },
  });
  if (attempts > MAX_LINK_ATTEMPTS_PER_HOUR) {
    return WHATSAPP_REPLIES.tooManyAttempts;
  }

  const codeHash = hashLinkCode(code);
  const link = await prisma.whatsAppLinkCode.findUnique({ where: { codeHash } });
  if (!link || link.expiresAt <= new Date()) {
    return WHATSAPP_REPLIES.invalidCode;
  }

  const linked = await prisma.$transaction(async (tx) => {
    // Consuming the code first makes it single-use: if two messages carry it
    // at once, the second waits for this row and then deletes nothing.
    const { count } = await tx.whatsAppLinkCode.deleteMany({
      where: { userId: link.userId, codeHash, expiresAt: { gt: new Date() } },
    });
    if (count === 0) {
      return false;
    }
    await tx.whatsAppMessage.deleteMany({
      where: { OR: [{ userId: link.userId }, { user: { whatsappNumber: from } }] },
    });
    await tx.user.updateMany({
      where: { whatsappNumber: from, NOT: { id: link.userId } },
      data: { whatsappNumber: null },
    });
    await tx.user.update({ where: { id: link.userId }, data: { whatsappNumber: from } });
    return true;
  });
  if (!linked) {
    return WHATSAPP_REPLIES.invalidCode;
  }
  return WHATSAPP_REPLIES.linked;
}

/**
 * The recent conversation plus the new message. Turns older than the idle
 * window are deleted first, so a conversation left alone starts over.
 */
async function loadConversation(userId: string, text: string): Promise<ChatMessage[]> {
  await prisma.whatsAppMessage.deleteMany({
    where: { userId, createdAt: { lt: new Date(Date.now() - HISTORY_IDLE_MS) } },
  });
  const history = await prisma.whatsAppMessage.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: MAX_HISTORY_MESSAGES,
    select: { role: true, content: true },
  });
  return [
    ...history.reverse().map(({ role, content }): ChatMessage => ({
      role: role === "USER" ? "user" : "assistant",
      content,
    })),
    { role: "user", content: text },
  ];
}

/**
 * Answers a linked user's message with the chat assistant, the same one as
 * the board's chat (same tools, limits and quota). Only a successful turn is
 * kept in the history: a failed one is sent again by the user anyway.
 */
async function answerWithAssistant(
  user: { id: string; timeZone: string | null },
  text: string
): Promise<string> {
  try {
    const messages = sanitizeChatMessages(await loadConversation(user.id, text));
    await consumeChatQuota(user.id);
    const { reply, createdNotes } = await runChatTurn({
      userId: user.id,
      messages,
      // Synced from the browser whenever the user opens the board.
      timeZone: resolveTimeZone(user.timeZone),
      locale: null,
    });
    const answer = (
      reply || (createdNotes.length > 0 ? WHATSAPP_REPLIES.noteCreated : WHATSAPP_REPLIES.noReply)
    ).slice(0, MAX_ASSISTANT_MESSAGE_LENGTH);

    // The reply a millisecond later, so the pair keeps its order when read back.
    const now = Date.now();
    await prisma.whatsAppMessage.createMany({
      data: [
        { userId: user.id, role: "USER", content: messages[messages.length - 1].content, createdAt: new Date(now) },
        { userId: user.id, role: "ASSISTANT", content: answer, createdAt: new Date(now + 1) },
      ],
    });
    return answer;
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (!(code in CHAT_ERROR_REPLIES)) {
      console.error("[whatsapp] assistant failed", error);
    }
    return CHAT_ERROR_REPLIES[code] ?? WHATSAPP_REPLIES.unavailable;
  }
}

/**
 * Handles one message received by the webhook and replies to it. A message
 * that is only a link code links the number (from a linked number too, which
 * moves the link); anything else needs a linked number.
 */
export async function handleInboundMessage(message: InboundMessage): Promise<void> {
  const code = message.text === null ? null : parseLinkCode(message.text);
  if (!(await recordInbound(message, code !== null))) {
    return;
  }

  if (code) {
    await sendWhatsAppText(message.from, await linkNumber(message.from, code));
    return;
  }

  const user = await prisma.user.findUnique({
    where: { whatsappNumber: message.from },
    select: { id: true, timeZone: true },
  });
  if (!user) {
    await sendWhatsAppText(message.from, WHATSAPP_REPLIES.notLinked);
    return;
  }
  if (message.text === null) {
    await sendWhatsAppText(message.from, WHATSAPP_REPLIES.textOnly);
    return;
  }

  await sendWhatsAppText(message.from, await answerWithAssistant(user, message.text));
}
