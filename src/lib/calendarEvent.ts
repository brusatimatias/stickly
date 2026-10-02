import type { calendar_v3 } from "googleapis";
import { MINUTE_MS } from "@/lib/time";

const EVENT_DURATION_MINUTES = 60;

/** The fields of a TIMED note that its Google Calendar event mirrors. */
export type CalendarEventNote = {
  title: string;
  location: string | null;
  description: string | null;
  startsAt: Date;
};

/** The Calendar event for a TIMED note, used both to create and to update it. */
export function toCalendarEvent(note: CalendarEventNote): calendar_v3.Schema$Event {
  return {
    summary: note.title,
    location: note.location ?? undefined,
    description: note.description ?? undefined,
    // A TIMED note is an instant (UTC), shown by Google in the calendar's zone.
    start: { dateTime: note.startsAt.toISOString() },
    end: {
      dateTime: new Date(note.startsAt.getTime() + EVENT_DURATION_MINUTES * MINUTE_MS).toISOString(),
    },
  };
}

/** Whether saving `after` changes what the note's Calendar event shows. */
export function calendarEventChanged(before: CalendarEventNote, after: CalendarEventNote): boolean {
  return (
    before.title !== after.title ||
    before.location !== after.location ||
    before.description !== after.description ||
    before.startsAt.getTime() !== after.startsAt.getTime()
  );
}
