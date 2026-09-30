import { describe, expect, test } from "vitest";
import {
  CREATE_DRAFT_NOTE_TOOL,
  CREATE_NOTE_TOOL,
  TITLE_SOFT_LIMIT,
  parseDraftNoteToolInput,
  parseListNotesInput,
  parseNoteToolInput,
  sanitizeDescription,
  sanitizeLocation,
  sanitizeTitle,
} from "@/lib/noteInput";

describe("sanitizeTitle", () => {
  test("trims and truncates to 80 characters", () => {
    expect(sanitizeTitle("  Buy milk  ")).toBe("Buy milk");
    expect(sanitizeTitle("a".repeat(100))).toHaveLength(80);
  });

  test("throws when blank", () => {
    expect(() => sanitizeTitle("   ")).toThrow("TITLE_REQUIRED");
  });
});

describe("sanitizeLocation / sanitizeDescription", () => {
  test("return null when blank", () => {
    expect(sanitizeLocation("  ")).toBeNull();
    expect(sanitizeDescription("")).toBeNull();
  });

  test("truncate to their max length", () => {
    expect(sanitizeLocation("a".repeat(100))).toHaveLength(60);
    expect(sanitizeDescription("a".repeat(400))).toHaveLength(300);
  });
});

describe("parseNoteToolInput", () => {
  test("accepts a full input and trims every field", () => {
    expect(
      parseNoteToolInput({
        title: " Buy a gift ",
        location: " Mall ",
        description: " Ceramics ",
        day: "2026-10-02",
        time: "18:00",
      })
    ).toEqual({
      title: "Buy a gift",
      location: "Mall",
      description: "Ceramics",
      day: "2026-10-02",
      time: "18:00",
    });
  });

  test("defaults missing or null optional fields to empty strings", () => {
    expect(parseNoteToolInput({ title: "Call the plumber", day: "2026-09-27", location: null })).toEqual({
      title: "Call the plumber",
      location: "",
      description: "",
      day: "2026-09-27",
      time: "",
    });
  });

  test("requires a day", () => {
    expect(() => parseNoteToolInput({ title: "Call the plumber" })).toThrow("DAY_REQUIRED");
    expect(() => parseNoteToolInput({ title: "Call the plumber", day: "  " })).toThrow("DAY_REQUIRED");
  });

  test.each(["27/09/2026", "2026-9-27", "2026-02-30", "2026-09-27T10:00:00Z", "tomorrow"])(
    "rejects the malformed day %s",
    (day) => {
      expect(() => parseNoteToolInput({ title: "Title", day })).toThrow("INVALID_DAY");
    }
  );

  test.each(["24:00", "9:00", "18:60", "6pm"])("rejects the malformed time %s", (time) => {
    expect(() => parseNoteToolInput({ title: "Title", day: "2026-09-27", time })).toThrow(
      "INVALID_TIME"
    );
  });

  test.each([null, "text", 42, ["title"]])("rejects the non-object input %j", (raw) => {
    expect(() => parseNoteToolInput(raw)).toThrow("INVALID_NOTE_INPUT");
  });

  test("rejects non-string fields", () => {
    expect(() => parseNoteToolInput({ title: 42, day: "2026-09-27" })).toThrow("INVALID_NOTE_INPUT");
    expect(() => parseNoteToolInput({ title: "Title", day: "2026-09-27", time: 1800 })).toThrow(
      "INVALID_NOTE_INPUT"
    );
  });
});

describe("parseDraftNoteToolInput", () => {
  test("trims the fields, defaults missing ones and ignores a day", () => {
    expect(
      parseDraftNoteToolInput({ title: " Buy batteries ", description: "AA", day: "2026-09-27" })
    ).toEqual({ title: "Buy batteries", location: "", description: "AA" });
  });

  test.each([null, "text", ["title"]])("rejects the non-object input %j", (raw) => {
    expect(() => parseDraftNoteToolInput(raw)).toThrow("INVALID_NOTE_INPUT");
  });

  test("rejects non-string fields", () => {
    expect(() => parseDraftNoteToolInput({ title: 42 })).toThrow("INVALID_NOTE_INPUT");
  });
});

describe("parseListNotesInput", () => {
  test("defaults to a single day and all statuses", () => {
    expect(parseListNotesInput({ from: "2026-09-26" })).toEqual({
      from: "2026-09-26",
      to: "2026-09-26",
      status: "all",
    });
  });

  test("accepts a range and a status", () => {
    expect(parseListNotesInput({ from: "2026-09-21", to: "2026-09-27", status: "pending" })).toEqual({
      from: "2026-09-21",
      to: "2026-09-27",
      status: "pending",
    });
  });

  test("requires a valid from day", () => {
    expect(() => parseListNotesInput({})).toThrow("DAY_REQUIRED");
    expect(() => parseListNotesInput({ from: "today" })).toThrow("INVALID_DAY");
    expect(() => parseListNotesInput({ from: "2026-09-21", to: "2026-02-30" })).toThrow("INVALID_DAY");
  });

  test("rejects a reversed or longer than 31-day range", () => {
    expect(() => parseListNotesInput({ from: "2026-09-27", to: "2026-09-21" })).toThrow(
      "INVALID_DATE_RANGE"
    );
    expect(() => parseListNotesInput({ from: "2026-09-01", to: "2026-10-03" })).toThrow(
      "INVALID_DATE_RANGE"
    );
    expect(parseListNotesInput({ from: "2026-09-01", to: "2026-10-02" }).to).toBe("2026-10-02");
  });

  test("rejects an unknown status or a non-object input", () => {
    expect(() => parseListNotesInput({ from: "2026-09-26", status: "late" })).toThrow(
      "INVALID_NOTE_INPUT"
    );
    expect(() => parseListNotesInput("2026-09-26")).toThrow("INVALID_NOTE_INPUT");
  });
});

describe("create_note tool schema", () => {
  const { title, description } = CREATE_NOTE_TOOL.inputSchema.properties;

  test("asks the model for short titles, under the soft limit", () => {
    expect(title.description).toContain(`at most ${TITLE_SOFT_LIMIT} characters`);
    expect(title.description).toContain("No day, time or place");
  });

  test("asks for summarized descriptions, omitted when empty", () => {
    expect(description.description).toContain("summarized rather than copied");
    expect(description.description).toContain("Omit when there are none");
  });

  test("gives drafts the same title and description rules", () => {
    expect(CREATE_DRAFT_NOTE_TOOL.inputSchema.properties.title).toBe(title);
    expect(CREATE_DRAFT_NOTE_TOOL.inputSchema.properties.description).toBe(description);
  });
});
