"use server";

import { revalidatePath } from "next/cache";
import { withGoogleCalendar } from "@/lib/googleCalendar";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

const EVENT_DURATION_MINUTES = 60;

/**
 * Creates (or updates, if already synced) a Google Calendar event for a
 * scheduled note, and persists the resulting googleEventId.
 */
export async function addNoteToGoogleCalendar(noteId: string) {
  const userId = await requireUserId();

  const note = await prisma.note.findFirst({
    where: { id: noteId, userId, isDraft: false },
  });
  if (!note?.startsAt) {
    throw new Error("NOTE_NOT_FOUND");
  }
  if (note.kind !== "TIMED") {
    throw new Error("TIME_REQUIRED_FOR_SYNC");
  }

  const requestBody = {
    summary: note.title,
    location: note.location ?? undefined,
    description: note.description ?? undefined,
    // A TIMED note is an instant (UTC), shown by Google in the calendar's zone.
    start: { dateTime: note.startsAt.toISOString() },
    end: {
      dateTime: new Date(note.startsAt.getTime() + EVENT_DURATION_MINUTES * 60_000).toISOString(),
    },
  };

  const response = await withGoogleCalendar(userId, (calendar) =>
    note.googleEventId
      ? calendar.events.update({ calendarId: "primary", eventId: note.googleEventId, requestBody })
      : calendar.events.insert({ calendarId: "primary", requestBody })
  );
  const googleEventId = response.data.id;

  if (googleEventId && googleEventId !== note.googleEventId) {
    try {
      await prisma.note.update({ where: { id: note.id }, data: { googleEventId } });
    } catch (error) {
      console.error(
        `Created Calendar event ${googleEventId} for note ${note.id} but failed to save it`,
        error
      );
      throw new Error("CALENDAR_SAVE_FAILED");
    }
  }

  revalidatePath("/");
}

/**
 * Best-effort delete of a note's Google Calendar event. Never throws: a
 * stale token or an already-deleted event must not block the caller from
 * saving the note itself.
 */
export async function unsyncNoteFromGoogleCalendar(googleEventId: string): Promise<void> {
  const userId = await requireUserId();

  try {
    await withGoogleCalendar(userId, (calendar) =>
      calendar.events.delete({ calendarId: "primary", eventId: googleEventId })
    );
  } catch {
    // Known/accepted edge case: event may already be gone, token may be stale.
  }
}
