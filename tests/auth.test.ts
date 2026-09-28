import { beforeEach, describe, expect, test, vi } from "vitest";

type JwtCallback = (params: Record<string, unknown>) => Promise<Record<string, unknown>>;

// Capture the config passed to NextAuth so the callbacks can be called directly.
const captured = vi.hoisted(() => ({ config: undefined as { callbacks: { jwt: JwtCallback } } | undefined }));
const mockPrisma = vi.hoisted(() => ({ user: { upsert: vi.fn() } }));
const mockSaveGoogleTokens = vi.hoisted(() => vi.fn());

vi.mock("next-auth", () => ({
  default: (config: typeof captured.config) => {
    captured.config = config;
    return { handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() };
  },
}));
vi.mock("next-auth/providers/google", () => ({ default: vi.fn(() => ({ id: "google" })) }));
vi.mock("next-auth/providers/credentials", () => ({ default: vi.fn(() => ({ id: "credentials" })) }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/googleTokens", () => ({ saveGoogleTokens: mockSaveGoogleTokens }));

await import("@/auth");
const jwt = (params: Record<string, unknown>) => captured.config!.callbacks.jwt(params);

const PROFILE = { sub: "google-sub-1", email: "Ada@Example.com", name: "Ada", picture: "https://img" };
const GOOGLE_ACCOUNT = {
  provider: "google",
  access_token: "access-1",
  refresh_token: "refresh-1",
  expires_at: 1_790_000_000,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.user.upsert.mockResolvedValue({ id: "user-1" });
});

describe("jwt callback", () => {
  test("on a Google sign in, upserts the user and stores the tokens on it, not in the JWT", async () => {
    const token = await jwt({ token: {}, account: GOOGLE_ACCOUNT, profile: PROFILE });

    expect(mockPrisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { googleId: "google-sub-1" } })
    );
    expect(mockSaveGoogleTokens).toHaveBeenCalledWith("user-1", {
      accessToken: "access-1",
      refreshToken: "refresh-1",
      accessTokenExpiresAt: new Date(1_790_000_000 * 1000),
    });
    expect(token).toEqual({ userId: "user-1" });
  });

  test("still signs in when the tokens can't be stored (e.g. no encryption key)", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockSaveGoogleTokens.mockRejectedValueOnce(new Error("GOOGLE_TOKEN_ENCRYPTION_KEY is not set"));

    const token = await jwt({ token: {}, account: GOOGLE_ACCOUNT, profile: PROFILE });

    expect(token).toEqual({ userId: "user-1" });
    expect(consoleError).toHaveBeenCalled();
  });

  test("a password sign in doesn't touch the Google tokens", async () => {
    const token = await jwt({
      token: {},
      account: { provider: "credentials" },
      user: { id: "user-1" },
    });

    expect(token).toEqual({ userId: "user-1" });
    expect(mockSaveGoogleTokens).not.toHaveBeenCalled();
  });

  test("later requests keep the token as is, without calling Google or the database", async () => {
    const token = await jwt({ token: { userId: "user-1" } });

    expect(token).toEqual({ userId: "user-1" });
    expect(mockPrisma.user.upsert).not.toHaveBeenCalled();
    expect(mockSaveGoogleTokens).not.toHaveBeenCalled();
  });
});
