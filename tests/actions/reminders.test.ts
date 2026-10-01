import { beforeEach, describe, expect, test, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({ user: { update: vi.fn() } }));
const mockAuth = vi.hoisted(() => vi.fn());
const mockQueueUserReminders = vi.hoisted(() => vi.fn());
const afterCallbacks = vi.hoisted(() => [] as (() => unknown)[]);

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: (callback: () => unknown) => afterCallbacks.push(callback) }));
vi.mock("@/lib/reminders", () => ({ queueUserReminders: mockQueueUserReminders }));

import { updateReminderSettings } from "@/app/actions/reminders";

const SETTINGS = { reminderMinutesBefore: 10, digestEnabled: true, digestTime: "07:00" };

beforeEach(() => {
  vi.clearAllMocks();
  afterCallbacks.length = 0;
  mockAuth.mockResolvedValue({ user: { id: "user-1" } });
});

describe("updateReminderSettings", () => {
  test("rejects when there's no session", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(updateReminderSettings(SETTINGS)).rejects.toThrow("UNAUTHORIZED");
  });

  test("rejects invalid settings without saving", async () => {
    await expect(updateReminderSettings({ ...SETTINGS, reminderMinutesBefore: 7 })).rejects.toThrow(
      "INVALID_REMINDER_SETTINGS"
    );
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  test("saves the current user's settings and queues what they now get", async () => {
    await updateReminderSettings({ ...SETTINGS, extra: "ignored" });

    expect(mockPrisma.user.update).toHaveBeenCalledWith({ where: { id: "user-1" }, data: SETTINGS });
    await Promise.all(afterCallbacks.map((callback) => callback()));
    expect(mockQueueUserReminders).toHaveBeenCalledWith("user-1");
  });
});
