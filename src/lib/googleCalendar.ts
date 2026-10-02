import { google, type calendar_v3 } from "googleapis";
import { toCalendarEvent, type CalendarEventNote } from "@/lib/calendarEvent";
import { clearGoogleTokens, getGoogleTokens, saveGoogleTokens } from "@/lib/googleTokens";
import { MINUTE_MS } from "@/lib/time";

/**
 * The only way the app talks to Google Calendar. It gets the user's access
 * token from the database (not the session, so password sessions work too),
 * refreshes it when it's about to expire, and retries once if Google still
 * rejects it. When Google has revoked the refresh token, the stored tokens
 * are cleared and GOOGLE_RECONNECT_REQUIRED is thrown: only a new Google sign
 * in can fix that.
 *
 * Kept out of "use server" files: it takes an already-resolved `userId`.
 */
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
// Refresh a bit early so a token doesn't expire between the check and the call.
const REFRESH_MARGIN_MS = MINUTE_MS;

function reconnectRequired(): Error {
  return new Error("GOOGLE_RECONNECT_REQUIRED");
}

function getStatus(error: unknown): number | undefined {
  return (
    (error as { response?: { status?: number } })?.response?.status ??
    (error as { code?: number })?.code
  );
}

async function refreshAccessToken(userId: string, refreshToken: string): Promise<string> {
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    // invalid_grant: the refresh token was revoked or expired for good.
    if (response.status === 400 && body.includes("invalid_grant")) {
      console.warn(`[google] refresh token of user ${userId} is no longer valid`);
      await clearGoogleTokens(userId);
      throw reconnectRequired();
    }
    console.error(`[google] token refresh failed for user ${userId} (${response.status})`, body);
    throw new Error(`Google token refresh failed: ${response.status}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  await saveGoogleTokens(userId, {
    accessToken: data.access_token,
    accessTokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
  });
  return data.access_token;
}

async function getAccessToken(userId: string, forceRefresh: boolean): Promise<string> {
  const tokens = await getGoogleTokens(userId);
  const isFresh =
    tokens.accessToken &&
    tokens.accessTokenExpiresAt &&
    tokens.accessTokenExpiresAt.getTime() - Date.now() > REFRESH_MARGIN_MS;
  if (!forceRefresh && isFresh) {
    return tokens.accessToken!;
  }
  if (!tokens.refreshToken) {
    throw reconnectRequired();
  }
  return refreshAccessToken(userId, tokens.refreshToken);
}

function getCalendarClient(accessToken: string): calendar_v3.Calendar {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.calendar({ version: "v3", auth: oauth2Client });
}

/** Runs `operation` with a Calendar client authorized as the user. */
export async function withGoogleCalendar<T>(
  userId: string,
  operation: (calendar: calendar_v3.Calendar) => Promise<T>
): Promise<T> {
  const accessToken = await getAccessToken(userId, false);
  try {
    return await operation(getCalendarClient(accessToken));
  } catch (error) {
    if (getStatus(error) !== 401) {
      throw error;
    }
  }

  // Google rejected a token we thought valid (revoked early, clock skew):
  // get a new one and try once more.
  const refreshedToken = await getAccessToken(userId, true);
  try {
    return await operation(getCalendarClient(refreshedToken));
  } catch (error) {
    if (getStatus(error) === 401) {
      console.error(`[google] Calendar rejected a fresh token for user ${userId}`, error);
      throw reconnectRequired();
    }
    throw error;
  }
}

/**
 * Best-effort delete of a note's Calendar event, for callers that must go on
 * saving or deleting the note anyway. Never throws; an event that's already
 * gone counts as deleted, and any other failure is logged, since the event is
 * left behind in the user's calendar.
 */
export async function deleteCalendarEvent(userId: string, googleEventId: string): Promise<void> {
  try {
    await withGoogleCalendar(userId, (calendar) =>
      calendar.events.delete({ calendarId: "primary", eventId: googleEventId })
    );
  } catch (error) {
    const status = getStatus(error);
    if (status === 404 || status === 410) {
      return;
    }
    console.error(`[google] couldn't delete Calendar event ${googleEventId} of user ${userId}`, error);
  }
}

/**
 * Best-effort update of a synced note's Calendar event, for when the note
 * changes after it was synced. Never throws: returns "missing" when the event
 * no longer exists in Google (deleted from Calendar), so the caller can unlink
 * the note, and "failed" (logged) for anything else.
 *
 * The event is read first: a deleted event can linger as "cancelled", and
 * writing it back could restore what the user deleted. The update starts from
 * that event so what the user added in Calendar (guests, reminders, color) is
 * kept; the fields the note owns are overwritten, and cleared when empty.
 */
export async function updateCalendarEvent(
  userId: string,
  googleEventId: string,
  note: CalendarEventNote
): Promise<"updated" | "missing" | "failed"> {
  try {
    return await withGoogleCalendar(userId, async (calendar) => {
      const { data: event } = await calendar.events.get({
        calendarId: "primary",
        eventId: googleEventId,
      });
      if (event.status === "cancelled") {
        return "missing";
      }
      await calendar.events.update({
        calendarId: "primary",
        eventId: googleEventId,
        requestBody: { ...event, ...toCalendarEvent(note) },
      });
      return "updated";
    });
  } catch (error) {
    const status = getStatus(error);
    if (status === 404 || status === 410) {
      return "missing";
    }
    console.error(`[google] couldn't update Calendar event ${googleEventId} of user ${userId}`, error);
    return "failed";
  }
}
