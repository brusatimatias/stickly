import { format, isValid, parseISO } from "date-fns";

const MAX_TITLE_LENGTH = 80;
const MAX_LOCATION_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 300;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function sanitizeTitle(title: string): string {
  const trimmed = title.trim().slice(0, MAX_TITLE_LENGTH);
  if (!trimmed) {
    throw new Error("TITLE_REQUIRED");
  }
  return trimmed;
}

export function sanitizeLocation(location: string): string | null {
  return location.trim().slice(0, MAX_LOCATION_LENGTH) || null;
}

export function sanitizeDescription(description: string): string | null {
  return description.trim().slice(0, MAX_DESCRIPTION_LENGTH) || null;
}

export type NoteToolInput = {
  title: string;
  location: string;
  description: string;
  day: string;
  time: string;
};

function readOptionalString(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value !== "string") {
    throw new Error("INVALID_NOTE_INPUT");
  }
  return value.trim();
}

/**
 * Validates the arguments of the `create_note` tool, which come as untrusted
 * JSON from the chat LLM or from an external WebMCP agent. Missing optional
 * fields become "", matching `createNote`'s form input. Length limits and the
 * blank-title check are applied later by `createNoteForUser`.
 */
export function parseNoteToolInput(raw: unknown): NoteToolInput {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("INVALID_NOTE_INPUT");
  }
  const input = raw as Record<string, unknown>;

  const title = readOptionalString(input.title);
  const location = readOptionalString(input.location);
  const description = readOptionalString(input.description);
  const day = readOptionalString(input.day);
  const time = readOptionalString(input.time);

  if (!day) {
    throw new Error("DAY_REQUIRED");
  }
  // The round trip rejects well-formed but nonexistent dates like 2026-02-30.
  const parsedDay = parseISO(day);
  if (!DAY_PATTERN.test(day) || !isValid(parsedDay) || format(parsedDay, "yyyy-MM-dd") !== day) {
    throw new Error("INVALID_DAY");
  }
  if (time && !TIME_PATTERN.test(time)) {
    throw new Error("INVALID_TIME");
  }

  return { title, location, description, day, time };
}
