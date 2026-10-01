import { describe, expect, test } from "vitest";
import {
  getNoteRemindAt,
  getUpcomingDigests,
  isReminderStillUseful,
  parseReminderSettings,
} from "@/lib/reminderSettings";

const BA = "America/Argentina/Buenos_Aires";

describe("parseReminderSettings", () => {
  test("accepts the offered lead times, off, and a HH:mm digest time", () => {
    expect(parseReminderSettings({ reminderMinutesBefore: 15, digestEnabled: true, digestTime: "07:30" })).toEqual({
      reminderMinutesBefore: 15,
      digestEnabled: true,
      digestTime: "07:30",
    });
    expect(parseReminderSettings({ reminderMinutesBefore: null, digestEnabled: false, digestTime: "23:59" }))
      .toMatchObject({ reminderMinutesBefore: null });
  });

  test.each([
    ["a lead time that isn't offered", { reminderMinutesBefore: 5, digestEnabled: false, digestTime: "07:00" }],
    ["a lead time as a string", { reminderMinutesBefore: "10", digestEnabled: false, digestTime: "07:00" }],
    ["a missing flag", { reminderMinutesBefore: null, digestTime: "07:00" }],
    ["an impossible time", { reminderMinutesBefore: null, digestEnabled: true, digestTime: "24:00" }],
    ["a time without minutes", { reminderMinutesBefore: null, digestEnabled: true, digestTime: "7" }],
    ["nothing", undefined],
  ])("rejects %s", (_case, input) => {
    expect(() => parseReminderSettings(input)).toThrow("INVALID_REMINDER_SETTINGS");
  });
});

describe("getNoteRemindAt", () => {
  test("is the lead time before the note starts", () => {
    expect(getNoteRemindAt(new Date("2026-10-02T13:00:00Z"), 15)).toEqual(new Date("2026-10-02T12:45:00Z"));
    expect(getNoteRemindAt(new Date("2026-10-02T13:00:00Z"), 0)).toEqual(new Date("2026-10-02T13:00:00Z"));
  });
});

describe("isReminderStillUseful", () => {
  const due = new Date("2026-10-02T12:00:00Z");
  test("allows up to an hour of delay, not more", () => {
    expect(isReminderStillUseful(due, new Date("2026-10-02T12:00:30Z"))).toBe(true);
    expect(isReminderStillUseful(due, new Date("2026-10-02T13:00:00Z"))).toBe(true);
    expect(isReminderStillUseful(due, new Date("2026-10-02T13:00:01Z"))).toBe(false);
  });
});

describe("getUpcomingDigests", () => {
  test("lists the next 48 h of digests at the local time, skipping today's if it passed", () => {
    // 10:00 in Buenos Aires: today's 07:00 digest already went.
    const now = new Date("2026-10-02T13:00:00Z");
    expect(getUpcomingDigests("07:00", BA, now)).toEqual([
      { day: "2026-10-03", at: new Date("2026-10-03T10:00:00Z") },
      { day: "2026-10-04", at: new Date("2026-10-04T10:00:00Z") },
    ]);
  });

  test("includes today's when it's still ahead", () => {
    // 05:00 in Buenos Aires.
    const now = new Date("2026-10-02T08:00:00Z");
    expect(getUpcomingDigests("07:00", BA, now).map(({ day }) => day)).toEqual([
      "2026-10-02",
      "2026-10-03",
    ]);
  });

  test("uses the user's day, not UTC's, near midnight", () => {
    // 22:30 in Buenos Aires on the 2nd is already the 3rd in UTC.
    const now = new Date("2026-10-03T01:30:00Z");
    expect(getUpcomingDigests("23:00", BA, now)[0]).toEqual({
      day: "2026-10-02",
      at: new Date("2026-10-03T02:00:00Z"),
    });
  });

  test("keeps the local time across a daylight saving change", () => {
    // Madrid moves its clocks back on 2026-10-25 (UTC+2 → UTC+1).
    const now = new Date("2026-10-24T08:00:00Z");
    expect(getUpcomingDigests("07:00", "Europe/Madrid", now)).toEqual([
      { day: "2026-10-25", at: new Date("2026-10-25T06:00:00Z") },
      { day: "2026-10-26", at: new Date("2026-10-26T06:00:00Z") },
    ]);
  });

  test("lands just after the jump for a time the clocks skip", () => {
    // Madrid skips 02:00–03:00 on 2026-03-29.
    const now = new Date("2026-03-28T12:00:00Z");
    expect(getUpcomingDigests("02:30", "Europe/Madrid", now)[0]).toEqual({
      day: "2026-03-29",
      at: new Date("2026-03-29T01:30:00Z"),
    });
  });
});
