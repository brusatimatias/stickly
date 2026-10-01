"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { queueUserReminders } from "@/lib/reminders";
import { parseReminderSettings } from "@/lib/reminderSettings";
import { requireUserId } from "@/lib/session";

/**
 * Saves the user's reminder settings (lead time for notes with a time, daily
 * digest and its time) and queues what they now get in the next 48 h.
 * Anything queued under the old settings is dropped when it's delivered.
 *
 * The digest goes out once a day, but turning it on or moving its time is
 * asking for it at the new time, so that lets today's go out again.
 */
export async function updateReminderSettings(input: unknown) {
  const userId = await requireUserId();
  const settings = parseReminderSettings(input);

  const previous = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { digestEnabled: true, digestTime: true },
  });
  const digestRescheduled =
    settings.digestEnabled && (!previous.digestEnabled || previous.digestTime !== settings.digestTime);

  await prisma.user.update({
    where: { id: userId },
    data: { ...settings, ...(digestRescheduled ? { digestSentOn: null } : {}) },
  });
  after(() => queueUserReminders(userId));

  revalidatePath("/profile");
}
