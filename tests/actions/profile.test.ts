import bcrypt from "bcryptjs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
  },
}));

const mockAuth = vi.hoisted(() => vi.fn());
const mockRevalidatePath = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));

import { setPassword } from "@/app/actions/profile";

const SESSION = { user: { id: "user-1" } };
let currentHash: string;

beforeAll(async () => {
  currentHash = await bcrypt.hash("old-password", 4);
});

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(SESSION);
});

describe("setPassword", () => {
  test("rejects when there's no session", async () => {
    mockAuth.mockResolvedValue(null);

    await expect(setPassword("new-password")).rejects.toThrow("UNAUTHORIZED");
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  test("sets a first password without asking for a current one", async () => {
    mockPrisma.user.findUniqueOrThrow.mockResolvedValue({ password: null });

    await setPassword("new-password");

    const { where, data } = mockPrisma.user.update.mock.calls[0][0];
    expect(where).toEqual({ id: "user-1" });
    expect(await bcrypt.compare("new-password", data.password)).toBe(true);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/profile");
  });

  test("requires the current password to change an existing one", async () => {
    mockPrisma.user.findUniqueOrThrow.mockResolvedValue({ password: currentHash });

    await expect(setPassword("new-password")).rejects.toThrow("CURRENT_PASSWORD_REQUIRED");
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  test("rejects a wrong current password", async () => {
    mockPrisma.user.findUniqueOrThrow.mockResolvedValue({ password: currentHash });

    await expect(setPassword("new-password", "not-it")).rejects.toThrow(
      "INVALID_CURRENT_PASSWORD"
    );
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  test("changes the password when the current one matches", async () => {
    mockPrisma.user.findUniqueOrThrow.mockResolvedValue({ password: currentHash });

    await setPassword("new-password", "old-password");

    const { data } = mockPrisma.user.update.mock.calls[0][0];
    expect(await bcrypt.compare("new-password", data.password)).toBe(true);
  });

  test("validates the new password before touching the database", async () => {
    await expect(setPassword("short")).rejects.toThrow("PASSWORD_TOO_SHORT");
    expect(mockPrisma.user.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});
