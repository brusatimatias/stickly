import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mockTokens = vi.hoisted(() => ({
  getGoogleTokens: vi.fn(),
  saveGoogleTokens: vi.fn(),
  clearGoogleTokens: vi.fn(),
}));
const mockSetCredentials = vi.hoisted(() => vi.fn());
const mockFetch = vi.hoisted(() => vi.fn());

vi.mock("@/lib/googleTokens", () => mockTokens);
vi.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: vi.fn(function (this: { setCredentials: typeof mockSetCredentials }) {
        this.setCredentials = mockSetCredentials;
      }),
    },
    // The fake client just carries the token it was authorized with.
    calendar: vi.fn(({ auth }) => ({ token: auth.setCredentials.mock.lastCall[0].access_token })),
  },
}));

import { deleteCalendarEvent, updateCalendarEvent, withGoogleCalendar } from "@/lib/googleCalendar";

const NOW = new Date("2026-09-28T12:00:00.000Z");
const minutesFromNow = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);

function storedTokens(overrides: Record<string, unknown> = {}) {
  return {
    refreshToken: "refresh-1",
    accessToken: "access-1",
    accessTokenExpiresAt: minutesFromNow(30),
    ...overrides,
  };
}

function tokenResponse(accessToken: string) {
  return new Response(JSON.stringify({ access_token: accessToken, expires_in: 3600 }), {
    status: 200,
  });
}

const tokenOf = (calendar: unknown) => (calendar as { token: string }).token;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.stubGlobal("fetch", mockFetch);
  mockTokens.getGoogleTokens.mockResolvedValue(storedTokens());
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("withGoogleCalendar", () => {
  test("uses the stored access token while it's fresh, without refreshing", async () => {
    const result = await withGoogleCalendar("user-1", async (calendar) => tokenOf(calendar));

    expect(result).toBe("access-1");
    expect(mockTokens.getGoogleTokens).toHaveBeenCalledWith("user-1");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("refreshes a token about to expire and stores the new one", async () => {
    mockTokens.getGoogleTokens.mockResolvedValue(storedTokens({ accessTokenExpiresAt: minutesFromNow(0.5) }));
    mockFetch.mockResolvedValue(tokenResponse("access-2"));

    const result = await withGoogleCalendar("user-1", async (calendar) => tokenOf(calendar));

    expect(result).toBe("access-2");
    expect(String(mockFetch.mock.calls[0][1].body)).toContain("refresh_token=refresh-1");
    expect(mockTokens.saveGoogleTokens).toHaveBeenCalledWith("user-1", {
      accessToken: "access-2",
      accessTokenExpiresAt: minutesFromNow(60),
    });
  });

  test("asks to reconnect when there's no refresh token to renew an expired token", async () => {
    mockTokens.getGoogleTokens.mockResolvedValue(
      storedTokens({ refreshToken: null, accessTokenExpiresAt: minutesFromNow(-5) })
    );
    const operation = vi.fn();

    await expect(withGoogleCalendar("user-1", operation)).rejects.toThrow("GOOGLE_RECONNECT_REQUIRED");
    expect(operation).not.toHaveBeenCalled();
  });

  test("clears the tokens and asks to reconnect when Google revoked the refresh token", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mockTokens.getGoogleTokens.mockResolvedValue(storedTokens({ accessTokenExpiresAt: null }));
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 })
    );

    await expect(withGoogleCalendar("user-1", vi.fn())).rejects.toThrow("GOOGLE_RECONNECT_REQUIRED");
    expect(mockTokens.clearGoogleTokens).toHaveBeenCalledWith("user-1");
  });

  test("logs any other refresh failure and keeps the tokens", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockTokens.getGoogleTokens.mockResolvedValue(storedTokens({ accessTokenExpiresAt: null }));
    mockFetch.mockResolvedValue(new Response("backend error", { status: 503 }));

    await expect(withGoogleCalendar("user-1", vi.fn())).rejects.toThrow(
      "Google token refresh failed: 503"
    );
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("(503)"), "backend error");
    expect(mockTokens.clearGoogleTokens).not.toHaveBeenCalled();
  });

  test("refreshes and retries once when Calendar rejects the token with a 401", async () => {
    mockFetch.mockResolvedValue(tokenResponse("access-2"));
    const operation = vi
      .fn()
      .mockRejectedValueOnce({ response: { status: 401 } })
      .mockImplementationOnce(async (calendar: unknown) => tokenOf(calendar));

    expect(await withGoogleCalendar("user-1", operation)).toBe("access-2");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  test("asks to reconnect when a freshly refreshed token is rejected too", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockFetch.mockResolvedValue(tokenResponse("access-2"));
    const operation = vi.fn().mockRejectedValue({ code: 401 });

    await expect(withGoogleCalendar("user-1", operation)).rejects.toThrow("GOOGLE_RECONNECT_REQUIRED");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  test("rethrows other Calendar errors without refreshing", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("network down"));

    await expect(withGoogleCalendar("user-1", operation)).rejects.toThrow("network down");
    expect(operation).toHaveBeenCalledTimes(1);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("deleteCalendarEvent", () => {
  test("deletes the event from the user's primary calendar", async () => {
    const mockDelete = vi.fn();
    const { google } = await import("googleapis");
    vi.mocked(google.calendar).mockReturnValueOnce({ events: { delete: mockDelete } } as never);

    await deleteCalendarEvent("user-1", "gcal-1");

    expect(mockDelete).toHaveBeenCalledWith({ calendarId: "primary", eventId: "gcal-1" });
  });

  test.each([404, 410])("treats a %s (event already gone) as deleted, silently", async (status) => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { google } = await import("googleapis");
    vi.mocked(google.calendar).mockReturnValueOnce({
      events: { delete: vi.fn().mockRejectedValue({ response: { status } }) },
    } as never);

    await expect(deleteCalendarEvent("user-1", "gcal-1")).resolves.toBeUndefined();
    expect(consoleError).not.toHaveBeenCalled();
  });

  test("logs any other failure instead of throwing", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockTokens.getGoogleTokens.mockResolvedValue(storedTokens({ refreshToken: null, accessToken: null }));

    await expect(deleteCalendarEvent("user-1", "gcal-1")).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("couldn't delete Calendar event gcal-1"),
      expect.any(Error)
    );
  });
});

describe("updateCalendarEvent", () => {
  const NOTE = {
    title: "Meeting",
    location: "Office",
    description: null,
    startsAt: new Date("2026-09-17T01:30:00.000Z"),
  };

  async function mockEvents(events: Record<string, unknown>) {
    const { google } = await import("googleapis");
    vi.mocked(google.calendar).mockReturnValueOnce({ events } as never);
  }

  test("updates the event with the note's fields, keeping what was added in Calendar", async () => {
    const mockUpdate = vi.fn();
    await mockEvents({
      get: vi.fn().mockResolvedValue({
        data: { id: "gcal-1", status: "confirmed", description: "old", attendees: [{ email: "a@b.c" }] },
      }),
      update: mockUpdate,
    });

    await expect(updateCalendarEvent("user-1", "gcal-1", NOTE)).resolves.toBe("updated");
    expect(mockUpdate).toHaveBeenCalledWith({
      calendarId: "primary",
      eventId: "gcal-1",
      requestBody: expect.objectContaining({
        summary: "Meeting",
        location: "Office",
        // Emptied in the note, so cleared in the event.
        description: undefined,
        start: { dateTime: "2026-09-17T01:30:00.000Z" },
        attendees: [{ email: "a@b.c" }],
      }),
    });
  });

  test("reports an event deleted from Calendar (still listed as cancelled) as missing, without restoring it", async () => {
    const mockUpdate = vi.fn();
    await mockEvents({
      get: vi.fn().mockResolvedValue({ data: { id: "gcal-1", status: "cancelled" } }),
      update: mockUpdate,
    });

    await expect(updateCalendarEvent("user-1", "gcal-1", NOTE)).resolves.toBe("missing");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test.each([404, 410])("reports a %s (event gone) as missing, silently", async (status) => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    await mockEvents({ get: vi.fn().mockRejectedValue({ response: { status } }) });

    await expect(updateCalendarEvent("user-1", "gcal-1", NOTE)).resolves.toBe("missing");
    expect(consoleError).not.toHaveBeenCalled();
  });

  test("logs any other failure instead of throwing", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockTokens.getGoogleTokens.mockResolvedValue(storedTokens({ refreshToken: null, accessToken: null }));

    await expect(updateCalendarEvent("user-1", "gcal-1", NOTE)).resolves.toBe("failed");
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("couldn't update Calendar event gcal-1"),
      expect.any(Error)
    );
  });
});
