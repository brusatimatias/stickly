import { dayToDate } from "@/lib/datetime";
import {
  sanitizeDay,
  sanitizeDescription,
  sanitizeLocation,
  sanitizeTime,
  sanitizeTitle,
} from "@/lib/noteInput";
import { prisma } from "@/lib/prisma";

/**
 * Creates a scheduled note at the end of its day. Shared by the board's
 * `createNote` action and the web chat's `create_note` tool.
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
  const day = sanitizeDay(input.day);
  const time = sanitizeTime(input.time);
  const date = dayToDate(day);

  const maxPosition = await prisma.note.aggregate({
    where: { userId, isDraft: false, date },
    _max: { position: true },
  });
  const position = (maxPosition._max.position ?? -1) + 1;

  await prisma.note.create({
    data: {
      id,
      title,
      location: sanitizeLocation(input.location),
      description: sanitizeDescription(input.description),
      date,
      time,
      position,
      userId,
    },
  });

  return { id, day };
}
