import { describe, expect, test } from "vitest";
import { insertAtIndex, sortDoneLast } from "@/lib/ordering";

describe("insertAtIndex", () => {
  test("inserts at the start", () => {
    expect(insertAtIndex(["b", "c"], "a", 0)).toEqual(["a", "b", "c"]);
  });

  test("inserts in the middle", () => {
    expect(insertAtIndex(["a", "c"], "b", 1)).toEqual(["a", "b", "c"]);
  });

  test("inserts at the end", () => {
    expect(insertAtIndex(["a", "b"], "c", 2)).toEqual(["a", "b", "c"]);
  });

  test("clamps an out-of-range positive index to the end", () => {
    expect(insertAtIndex(["a", "b"], "c", 99)).toEqual(["a", "b", "c"]);
  });

  test("clamps a negative index to the start", () => {
    expect(insertAtIndex(["b", "c"], "a", -5)).toEqual(["a", "b", "c"]);
  });

  test("does not mutate the original array", () => {
    const original = ["a", "b"];
    insertAtIndex(original, "c", 1);
    expect(original).toEqual(["a", "b"]);
  });
});

describe("sortDoneLast", () => {
  test("moves done items after pending ones, preserving relative order within each group", () => {
    const items = [
      { id: "a", isDone: true },
      { id: "b", isDone: false },
      { id: "c", isDone: true },
      { id: "d", isDone: false },
    ];
    expect(sortDoneLast(items).map((item) => item.id)).toEqual(["b", "d", "a", "c"]);
  });

  test("does not mutate the original array", () => {
    const items = [{ id: "a", isDone: true }, { id: "b", isDone: false }];
    sortDoneLast(items);
    expect(items.map((item) => item.id)).toEqual(["a", "b"]);
  });
});
