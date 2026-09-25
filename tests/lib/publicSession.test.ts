import { describe, expect, test } from "vitest";
import { toPublicSession } from "@/lib/publicSession";

describe("toPublicSession", () => {
  test("removes the Google access token and keeps everything else", () => {
    const session = {
      user: { id: "user-1", name: "Ada" },
      expires: "2026-10-25T00:00:00.000Z",
      accessToken: "google-token",
    };

    expect(toPublicSession(session)).toEqual({
      user: { id: "user-1", name: "Ada" },
      expires: "2026-10-25T00:00:00.000Z",
    });
  });

  test("does not mutate the original session", () => {
    const session = { user: { id: "user-1" }, accessToken: "google-token" };
    toPublicSession(session);
    expect(session.accessToken).toBe("google-token");
  });

  test("passes a signed-out (null) session through", () => {
    expect(toPublicSession(null)).toBeNull();
  });
});
