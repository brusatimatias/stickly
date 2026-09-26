import { describe, expect, test } from "vitest";
import {
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
