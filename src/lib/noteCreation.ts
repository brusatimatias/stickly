import { addDays, startOfDay } from "date-fns";
import { combineDayAndTime } from "@/lib/datetime";
import { sanitizeDescription, sanitizeLocation, sanitizeTitle } from "@/lib/noteInput";
import { prisma } from "@/lib/prisma";

/**
 * Creates a scheduled note at the end of its day. Shared by the board's
 * `createNote` action and the `create_note` tool (web chat and WebMCP).
 * Kept outside `"use server"` files on purpose: it takes an already-resolved
 * `userId`, so it must never be exposed as a server action itself.
 *
 * `id` is client-generated when coming from the board (optimistic UI); tool
 * calls omit it and get a server-generated one. Tool arguments are untrusted
 * JSON, so run them through `parseNoteToolInput` before calling this.
 */
export async function createNoteForUser(
  userId: string,
  input: {
    id?: string;
    title: string;
    location: string;
    description: string;
    day: string;
    time: string;
  }
): Promise<{ id: string; day: string }> {
  const id = input.id ?? crypto.randomUUID();
  const title = sanitizeTitle(input.title);
  const hasTime = input.time !== "";
  const scheduledAt = combineDayAndTime(input.day, hasTime ? input.time : "00:00");
  const dayStart = startOfDay(scheduledAt);
  const dayEnd = addDays(dayStart, 1);

  const maxPosition = await prisma.note.aggregate({
    where: { userId, isDraft: false, scheduledAt: { gte: dayStart, lt: dayEnd } },
    _max: { position: true },
  });
  const position = (maxPosition._max.position ?? -1) + 1;

  await prisma.note.create({
    data: {
      id,
      title,
      location: sanitizeLocation(input.location),
      description: sanitizeDescription(input.description),
      scheduledAt,
      hasTime,
      position,
      userId,
    },
  });

  return { id, day: input.day };
}
