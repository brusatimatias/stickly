import { differenceInCalendarDays, format, isValid, parseISO } from "date-fns";

const MAX_TITLE_LENGTH = 80;
const MAX_LOCATION_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 300;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
// Caps how many notes a single list_notes call can pull into the model.
const MAX_LIST_RANGE_DAYS = 31;

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

/**
 * The `create_note` tool as exposed to the web chat LLM. Its arguments are
 * validated with `parseNoteToolInput` rather than trusting the schema.
 */
export const CREATE_NOTE_TOOL = {
  name: "create_note",
  description:
    "Creates a note (reminder) on the user's Stickly weekly board, on the given day and optionally at a given time.",
  inputSchema: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: `Short action-style title, at most ${MAX_TITLE_LENGTH} characters, e.g. "Call the plumber".`,
      },
      day: { type: "string", description: "Day of the note, yyyy-MM-dd." },
      time: { type: "string", description: "Time of day in 24h HH:mm. Omit when none was given." },
      location: {
        type: "string",
        description: `Place, only if one was mentioned. At most ${MAX_LOCATION_LENGTH} characters.`,
      },
      description: {
        type: "string",
        description: `Extra details that don't fit the title. At most ${MAX_DESCRIPTION_LENGTH} characters.`,
      },
    },
    required: ["title", "day"],
    additionalProperties: false,
  },
} as const;

export const LIST_NOTES_STATUSES = ["all", "pending", "done"] as const;
export type ListNotesStatus = (typeof LIST_NOTES_STATUSES)[number];

/**
 * Read-only companion of `create_note`, so the web chat can answer "what do
 * I have today / this week" from the user's notes.
 */
export const LIST_NOTES_TOOL = {
  name: "list_notes",
  description:
    "Lists the user's scheduled notes (reminders) between two days, inclusive, ordered by day and board position. Draft notes without a date are not included.",
  inputSchema: {
    type: "object",
    properties: {
      from: { type: "string", description: "First day, yyyy-MM-dd." },
      to: {
        type: "string",
        description: `Last day (inclusive), yyyy-MM-dd. Defaults to "from". At most ${MAX_LIST_RANGE_DAYS} days after "from".`,
      },
      status: {
        type: "string",
        enum: [...LIST_NOTES_STATUSES],
        description: 'Filter by completion: "pending" (not done), "done", or "all" (default).',
      },
    },
    required: ["from"],
    additionalProperties: false,
  },
} as const;

export type ListNotesInput = { from: string; to: string; status: ListNotesStatus };

export type NoteToolInput = {
  title: string;
  location: string;
  description: string;
  day: string;
  time: string;
};

function readInputObject(raw: unknown): Record<string, unknown> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("INVALID_NOTE_INPUT");
  }
  return raw as Record<string, unknown>;
}

function validateDay(day: string): void {
  if (!day) {
    throw new Error("DAY_REQUIRED");
  }
  // The round trip rejects well-formed but nonexistent dates like 2026-02-30.
  const parsedDay = parseISO(day);
  if (!DAY_PATTERN.test(day) || !isValid(parsedDay) || format(parsedDay, "yyyy-MM-dd") !== day) {
    throw new Error("INVALID_DAY");
  }
}

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
 * JSON from the chat LLM. Missing optional fields become "", matching
 * `createNote`'s form input. Length limits and the blank-title check are
 * applied later by `createNoteForUser`.
 */
export function parseNoteToolInput(raw: unknown): NoteToolInput {
  const input = readInputObject(raw);

  const title = readOptionalString(input.title);
  const location = readOptionalString(input.location);
  const description = readOptionalString(input.description);
  const day = readOptionalString(input.day);
  const time = readOptionalString(input.time);

  validateDay(day);
  if (time && !TIME_PATTERN.test(time)) {
    throw new Error("INVALID_TIME");
  }

  return { title, location, description, day, time };
}

/** Validates the untrusted arguments of the `list_notes` tool. */
export function parseListNotesInput(raw: unknown): ListNotesInput {
  const input = readInputObject(raw);

  const from = readOptionalString(input.from);
  validateDay(from);
  const to = readOptionalString(input.to) || from;
  validateDay(to);

  const rangeDays = differenceInCalendarDays(parseISO(to), parseISO(from));
  if (rangeDays < 0 || rangeDays > MAX_LIST_RANGE_DAYS) {
    throw new Error("INVALID_DATE_RANGE");
  }

  const status = readOptionalString(input.status) || "all";
  if (!LIST_NOTES_STATUSES.includes(status as ListNotesStatus)) {
    throw new Error("INVALID_NOTE_INPUT");
  }

  return { from, to, status: status as ListNotesStatus };
}
