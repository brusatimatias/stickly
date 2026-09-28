import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), update: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { clearGoogleTokens, getGoogleTokens, saveGoogleTokens } from "@/lib/googleTokens";
import { decryptToken, encryptToken } from "@/lib/tokenCrypto";

const EXPIRES_AT = new Date("2026-09-28T20:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
});

afterEach(() => {
  delete process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
});

describe("getGoogleTokens", () => {
  test("decrypts the stored tokens of the user", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      googleRefreshToken: encryptToken("refresh-1"),
      googleAccessToken: encryptToken("access-1"),
      googleAccessTokenExpiresAt: EXPIRES_AT,
    });

    expect(await getGoogleTokens("user-1")).toEqual({
      refreshToken: "refresh-1",
      accessToken: "access-1",
      accessTokenExpiresAt: EXPIRES_AT,
    });
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user-1" } })
    );
  });

  test("returns no tokens for a user that never stored them", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      googleRefreshToken: null,
      googleAccessToken: null,
      googleAccessTokenExpiresAt: null,
    });

    expect(await getGoogleTokens("user-1")).toEqual({
      refreshToken: null,
      accessToken: null,
      accessTokenExpiresAt: null,
    });
  });

  test("treats tokens it can't decrypt (another key) as no tokens, and logs it", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const stored = encryptToken("refresh-1");
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    mockPrisma.user.findUnique.mockResolvedValue({
      googleRefreshToken: stored,
      googleAccessToken: null,
      googleAccessTokenExpiresAt: null,
    });

    expect((await getGoogleTokens("user-1")).refreshToken).toBeNull();
    expect(consoleError).toHaveBeenCalled();
  });
});

describe("saveGoogleTokens", () => {
  test("stores both tokens encrypted, with the expiry", async () => {
    await saveGoogleTokens("user-1", {
      accessToken: "access-1",
      refreshToken: "refresh-1",
      accessTokenExpiresAt: EXPIRES_AT,
    });

    const { where, data } = mockPrisma.user.update.mock.calls[0][0];
    expect(where).toEqual({ id: "user-1" });
    expect(decryptToken(data.googleAccessToken)).toBe("access-1");
    expect(decryptToken(data.googleRefreshToken)).toBe("refresh-1");
    expect(data.googleAccessTokenExpiresAt).toEqual(EXPIRES_AT);
  });

  test("keeps the stored refresh token when none is given", async () => {
    await saveGoogleTokens("user-1", { accessToken: "access-2", accessTokenExpiresAt: EXPIRES_AT });

    expect(mockPrisma.user.update.mock.calls[0][0].data).not.toHaveProperty("googleRefreshToken");
  });
});

describe("clearGoogleTokens", () => {
  test("forgets all of the user's tokens", async () => {
    await clearGoogleTokens("user-1");

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { googleRefreshToken: null, googleAccessToken: null, googleAccessTokenExpiresAt: null },
    });
  });
});
