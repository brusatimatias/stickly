"use server";

import { google } from "googleapis";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const EVENT_DURATION_MS = 60 * 60 * 1000; // 1 hour

function getCalendarClient(accessToken: string) {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.calendar({ version: "v3", auth: oauth2Client });
}

function isAuthError(error: unknown): boolean {
  const status =
    (error as { response?: { status?: number } })?.response?.status ??
    (error as { code?: number })?.code;
  return status === 401;
}

/**
 * Creates (or updates, if already synced) a Google Calendar event for a
 * scheduled note, and persists the resulting googleEventId.
 */
export async function addNoteToGoogleCalendar(noteId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("UNAUTHORIZED");
  }
  if (!session.accessToken) {
    throw new Error("MISSING_GOOGLE_TOKEN");
  }

  const note = await prisma.note.findFirst({
    where: { id: noteId, userId: session.user.id, isDraft: false },
  });
  if (!note?.scheduledAt) {
    throw new Error("NOTE_NOT_FOUND");
  }
  if (!note.hasTime) {
    throw new Error("TIME_REQUIRED_FOR_SYNC");
  }

  const calendar = getCalendarClient(session.accessToken);

  const requestBody = {
    summary: note.title,
    location: note.location ?? undefined,
    description: note.description ?? undefined,
    start: { dateTime: note.scheduledAt.toISOString() },
    end: {
      dateTime: new Date(note.scheduledAt.getTime() + EVENT_DURATION_MS).toISOString(),
    },
  };

  let googleEventId: string | null | undefined;
  try {
    const response = note.googleEventId
      ? await calendar.events.update({
          calendarId: "primary",
          eventId: note.googleEventId,
          requestBody,
        })
      : await calendar.events.insert({ calendarId: "primary", requestBody });
    googleEventId = response.data.id;
  } catch (error) {
    if (isAuthError(error)) {
      throw new Error("GOOGLE_SESSION_EXPIRED");
    }
    throw error;
  }

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
  const session = await auth();
  if (!session?.user?.id || !session.accessToken) {
    return;
  }

  try {
    const calendar = getCalendarClient(session.accessToken);
    await calendar.events.delete({ calendarId: "primary", eventId: googleEventId });
  } catch {
    // Known/accepted edge case: event may already be gone, token may be stale.
  }
}
