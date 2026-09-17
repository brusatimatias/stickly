import { describe, expect, test } from "vitest";
import { getNoteStyle } from "@/lib/noteColor";

describe("getNoteStyle", () => {
  test("is deterministic for the same id", () => {
    const id = "note-123";
    expect(getNoteStyle(id)).toEqual(getNoteStyle(id));
  });

  test("returns a complete style shape", () => {
    const style = getNoteStyle("note-abc");
    expect(style).toMatchObject({
      bg: expect.stringMatching(/^bg-/),
      border: expect.stringMatching(/^border-/),
      text: expect.stringMatching(/^text-/),
      rotation: expect.stringMatching(/rotate-/),
      overlapStyle: {
        marginTop: expect.stringMatching(/^-?\d+px$/),
        marginLeft: expect.stringMatching(/^-?\d+px$/),
      },
    });
  });

  test("varies across different ids", () => {
    const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const styles = ids.map((id) => JSON.stringify(getNoteStyle(id)));
    expect(new Set(styles).size).toBeGreaterThan(1);
  });
});
