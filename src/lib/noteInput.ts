import { differenceInCalendarDays, parseISO } from "date-fns";
import { isValidDay } from "@/lib/datetime";

const MAX_TITLE_LENGTH = 80;
/**
 * What the chat's model is asked to keep titles under. Not enforced: the hard
 * cap is MAX_TITLE_LENGTH, for the board too; this keeps a card readable.
 */
export const TITLE_SOFT_LIMIT = 40;
const MAX_LOCATION_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 300;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
// Caps how many notes a single list_notes call can pull into the model.
const MAX_LIST_RANGE_DAYS = 31;

const MAX_ID_LENGTH = 64;

/** Whether `value` looks like one of our ids (cuid or uuid): a short, non-empty string. */
export function isValidId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_ID_LENGTH;
}

/** How many draft notes (no date yet) a user can keep at once. */
export const MAX_DRAFT_NOTES = 4;

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
        description: `2 to 6 words, at most ${TITLE_SOFT_LIMIT} characters, starting with a verb or the key noun, e.g. "Call the plumber". No day, time or place (they have their own fields) and no filler like "remind me to".`,
      },
      day: { type: "string", description: "Day of the note, yyyy-MM-dd." },
      time: { type: "string", description: "Time of day in 24h HH:mm. Omit when none was given." },
      location: {
        type: "string",
        description: `Place, only if one was mentioned. At most ${MAX_LOCATION_LENGTH} characters.`,
      },
      description: {
        type: "string",
        description: `Other useful details (who, what to bring, amounts, phone numbers), summarized rather than copied from the message. Omit when there are none. At most ${MAX_DESCRIPTION_LENGTH} characters.`,
      },
    },
    required: ["title", "day"],
    additionalProperties: false,
  },
} as const;

/**
 * The `create_draft_note` tool: a note with no date yet, kept in the board's
 * draft panel. Validated with `parseDraftNoteToolInput`.
 */
export const CREATE_DRAFT_NOTE_TOOL = {
  name: "create_draft_note",
  description: `Creates a draft note (no date) in the draft panel of the user's Stickly board. Only use it when the user explicitly asks for a draft ("borrador"); a note missing its date is not a draft. The user can keep at most ${MAX_DRAFT_NOTES} drafts.`,
  inputSchema: {
    type: "object",
    properties: {
      title: CREATE_NOTE_TOOL.inputSchema.properties.title,
      location: CREATE_NOTE_TOOL.inputSchema.properties.location,
      description: CREATE_NOTE_TOOL.inputSchema.properties.description,
    },
    required: ["title"],
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

/** What the user writes in a note (board forms or chat), before sanitizing. */
export type NoteFields = { title: string; location: string; description: string };

export type NoteToolInput = NoteFields & { day: string; time: string };

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
  if (!isValidDay(day)) {
    throw new Error("INVALID_DAY");
  }
}

/** Validates a note's `yyyy-MM-dd` day coming from the client or a tool call. */
export function sanitizeDay(day: string): string {
  validateDay(day);
  return day;
}

/** Validates a note's `HH:mm` time; "" means no time and becomes null. */
export function sanitizeTime(time: string): string | null {
  if (!time) {
    return null;
  }
  if (!TIME_PATTERN.test(time)) {
    throw new Error("INVALID_TIME");
  }
  return time;
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

  const { title, location, description } = parseDraftNoteToolInput(input);
  const day = readOptionalString(input.day);
  const time = readOptionalString(input.time);

  sanitizeDay(day);
  sanitizeTime(time);

  return { title, location, description, day, time };
}

/**
 * Validates the untrusted arguments of the `create_draft_note` tool; like
 * `parseNoteToolInput`, the blank-title check and length limits are left to
 * `createDraftNoteForUser`.
 */
export function parseDraftNoteToolInput(raw: unknown): NoteFields {
  const input = readInputObject(raw);
  return {
    title: readOptionalString(input.title),
    location: readOptionalString(input.location),
    description: readOptionalString(input.description),
  };
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
