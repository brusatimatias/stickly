"use server";

import { revalidatePath } from "next/cache";
import { toCalendarEvent } from "@/lib/calendarEvent";
import { withGoogleCalendar } from "@/lib/googleCalendar";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

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

  const requestBody = toCalendarEvent({ ...note, startsAt: note.startsAt });

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
