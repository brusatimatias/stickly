import bcrypt from "bcryptjs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  user: { findFirst: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { authorizeCredentials, normalizeEmail } from "@/lib/credentials";

let passwordHash: string;

beforeAll(async () => {
  passwordHash = await bcrypt.hash("correct-horse", 4);
});

beforeEach(() => {
  mockPrisma.user.findFirst.mockReset();
});

describe("normalizeEmail", () => {
  test("trims and lowercases", () => {
    expect(normalizeEmail("  Ada@Example.COM ")).toBe("ada@example.com");
  });
});

describe("authorizeCredentials", () => {
  test("returns the user id when the password matches", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: "user-1", password: passwordHash });

    await expect(authorizeCredentials("ada@example.com", "correct-horse")).resolves.toEqual({
      id: "user-1",
    });
  });

  test("looks the email up normalized and case-insensitively", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    await authorizeCredentials("  Ada@Example.COM ", "whatever");

    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: "ada@example.com", mode: "insensitive" } },
      select: { id: true, password: true },
    });
  });

  test("returns null for a wrong password", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: "user-1", password: passwordHash });

    await expect(authorizeCredentials("ada@example.com", "wrong")).resolves.toBeNull();
  });

  test("still runs bcrypt when the user doesn't exist, so timing doesn't reveal it", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const compare = vi.spyOn(bcrypt, "compare");

    await expect(authorizeCredentials("nobody@example.com", "whatever")).resolves.toBeNull();

    expect(compare).toHaveBeenCalledOnce();
    compare.mockRestore();
  });

  test("returns null for a Google-only user without a password", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: "user-1", password: null });

    await expect(authorizeCredentials("ada@example.com", "whatever")).resolves.toBeNull();
  });

  test("returns null without querying when a field is missing or not a string", async () => {
    await expect(authorizeCredentials("", "pw")).resolves.toBeNull();
    await expect(authorizeCredentials("ada@example.com", undefined)).resolves.toBeNull();
    await expect(authorizeCredentials(["ada@example.com"], "pw")).resolves.toBeNull();
    expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
  });
});
