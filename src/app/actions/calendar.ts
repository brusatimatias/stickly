"use server";

import { google } from "googleapis";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const EVENT_DURATION_MS = 60 * 60 * 1000; // 1 hour

/**
 * Creates (or updates, if already synced) a Google Calendar event for a
 * scheduled note, and persists the resulting googleEventId.
 */
export async function addNoteToGoogleCalendar(noteId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  if (!session.accessToken) {
    throw new Error("Missing Google access token. Please sign in again.");
  }

  const note = await prisma.note.findFirst({
    where: { id: noteId, userId: session.user.id, isDraft: false },
  });
  if (!note?.scheduledAt) {
    throw new Error("Note not found");
  }

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: session.accessToken });
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const requestBody = {
    summary: note.title,
    location: note.location ?? undefined,
    start: { dateTime: note.scheduledAt.toISOString() },
    end: {
      dateTime: new Date(note.scheduledAt.getTime() + EVENT_DURATION_MS).toISOString(),
    },
  };

  const response = note.googleEventId
    ? await calendar.events.update({
        calendarId: "primary",
        eventId: note.googleEventId,
        requestBody,
      })
    : await calendar.events.insert({ calendarId: "primary", requestBody });

  const googleEventId = response.data.id;
  if (googleEventId && googleEventId !== note.googleEventId) {
    await prisma.note.update({ where: { id: note.id }, data: { googleEventId } });
  }

  revalidatePath("/");
}
