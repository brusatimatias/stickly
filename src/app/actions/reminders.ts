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
 */
export async function updateReminderSettings(input: unknown) {
  const userId = await requireUserId();
  const settings = parseReminderSettings(input);

  await prisma.user.update({ where: { id: userId }, data: settings });
  after(() => queueUserReminders(userId));

  revalidatePath("/profile");
}
