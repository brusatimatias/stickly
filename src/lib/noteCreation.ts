import { sanitizeDescription, sanitizeLocation, sanitizeTitle } from "@/lib/noteInput";
import { prisma } from "@/lib/prisma";
import type { StoredSchedule } from "@/lib/schedule";

/**
 * Creates a scheduled note at the end of its day. Shared by the board's
 * `createNote` action and the web chat's `create_note` tool, each of which
 * converts the user's local day and time into `schedule` first.
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
    schedule: StoredSchedule;
  }
): Promise<{ id: string }> {
  const id = input.id ?? crypto.randomUUID();
  const title = sanitizeTitle(input.title);

  // Which local day a TIMED note falls on depends on the viewer's zone, so
  // "last in its day" is taken as last among all the user's notes: positions
  // only need to order notes within a day, not be contiguous.
  const maxPosition = await prisma.note.aggregate({
    where: { userId, isDraft: false },
    _max: { position: true },
  });
  const position = (maxPosition._max.position ?? -1) + 1;

  await prisma.note.create({
    data: {
      id,
      title,
      location: sanitizeLocation(input.location),
      description: sanitizeDescription(input.description),
      kind: input.schedule.kind,
      startsAt: input.schedule.startsAt,
      position,
      userId,
    },
  });

  return { id };
}
