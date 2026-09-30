"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { isSupportedLocale, DEFAULT_LOCALE } from "@/i18n/locales";
import { consumeChatQuota, runChatTurn } from "@/lib/chatAssistant";
import { requireUserId } from "@/lib/session";
import { resolveTimeZone } from "@/lib/timezone";
import { sanitizeChatMessages } from "@/lib/webChat";

export async function sendChatMessage(input: { messages: unknown; timeZone: string }) {
  const userId = await requireUserId();
  const messages = sanitizeChatMessages(input.messages);
  await consumeChatQuota(userId);

  const requestLocale = await getLocale();
  const locale = isSupportedLocale(requestLocale) ? requestLocale : DEFAULT_LOCALE;
  // The browser sends its zone with each message.
  const result = await runChatTurn({
    userId,
    messages,
    timeZone: resolveTimeZone(input.timeZone),
    locale,
  });
  if (result.createdNotes.length > 0) {
    revalidatePath("/");
  }
  return result;
}
