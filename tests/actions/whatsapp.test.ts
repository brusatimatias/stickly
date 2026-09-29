import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  user: { update: vi.fn() },
  whatsAppLinkCode: { upsert: vi.fn(), deleteMany: vi.fn() },
  whatsAppMessage: { deleteMany: vi.fn() },
  $transaction: vi.fn(),
}));

const mockAuth = vi.hoisted(() => vi.fn());
const mockRevalidatePath = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));

import { createWhatsAppLinkCode, unlinkWhatsApp } from "@/app/actions/whatsapp";
import { hashLinkCode } from "@/lib/whatsappLink";

const SESSION = { user: { id: "user-1" } };

function uniqueViolation() {
  return Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AUTH_SECRET", "test-secret");
  mockAuth.mockResolvedValue(SESSION);
  mockPrisma.whatsAppLinkCode.upsert.mockResolvedValue({});
  mockPrisma.$transaction.mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createWhatsAppLinkCode", () => {
  test("rejects when there's no session", async () => {
    mockAuth.mockResolvedValue(null);

    await expect(createWhatsAppLinkCode()).rejects.toThrow("UNAUTHORIZED");
    expect(mockPrisma.whatsAppLinkCode.upsert).not.toHaveBeenCalled();
  });

  test("stores only the hash of the code, for the current user, expiring in 10 minutes", async () => {
    const before = Date.now();

    const { code, expiresAt } = await createWhatsAppLinkCode();

    expect(code).toMatch(/^\d{6}$/);
    const ttl = expiresAt.getTime() - before;
    expect(ttl).toBeGreaterThanOrEqual(10 * 60_000);
    expect(ttl).toBeLessThan(10 * 60_000 + 1000);

    const [{ where, create, update }] = mockPrisma.whatsAppLinkCode.upsert.mock.calls[0];
    expect(where).toEqual({ userId: "user-1" });
    expect(create).toEqual({ userId: "user-1", codeHash: hashLinkCode(code), expiresAt });
    expect(update).toMatchObject({ codeHash: hashLinkCode(code), expiresAt });
    expect(JSON.stringify([create, update])).not.toContain(code);
  });

  test("draws a new code when the hash collides with another user's", async () => {
    mockPrisma.whatsAppLinkCode.upsert.mockRejectedValueOnce(uniqueViolation());

    await createWhatsAppLinkCode();

    expect(mockPrisma.whatsAppLinkCode.upsert).toHaveBeenCalledTimes(2);
  });

  test("gives up after a few collisions", async () => {
    mockPrisma.whatsAppLinkCode.upsert.mockRejectedValue(uniqueViolation());

    await expect(createWhatsAppLinkCode()).rejects.toThrow("Unique constraint failed");
    expect(mockPrisma.whatsAppLinkCode.upsert).toHaveBeenCalledTimes(3);
  });

  test("doesn't retry other errors", async () => {
    mockPrisma.whatsAppLinkCode.upsert.mockRejectedValue(new Error("connection lost"));

    await expect(createWhatsAppLinkCode()).rejects.toThrow("connection lost");
    expect(mockPrisma.whatsAppLinkCode.upsert).toHaveBeenCalledTimes(1);
  });
});

describe("unlinkWhatsApp", () => {
  test("rejects when there's no session", async () => {
    mockAuth.mockResolvedValue(null);

    await expect(unlinkWhatsApp()).rejects.toThrow("UNAUTHORIZED");
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  test("clears the number, the pending code and the conversation of the current user", async () => {
    await unlinkWhatsApp();

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { whatsappNumber: null },
    });
    expect(mockPrisma.whatsAppLinkCode.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    expect(mockPrisma.whatsAppMessage.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/profile");
  });
});
