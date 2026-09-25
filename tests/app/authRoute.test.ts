import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mockHandlers = vi.hoisted(() => ({ GET: vi.fn(), POST: vi.fn() }));

vi.mock("@/auth", () => ({ handlers: mockHandlers }));

import { GET, POST } from "@/app/api/auth/[...nextauth]/route";

const SESSION = {
  user: { id: "user-1", name: "Ada" },
  expires: "2026-10-25T00:00:00.000Z",
  accessToken: "google-token",
};

function jsonResponse(body: unknown) {
  const headers = new Headers({ "content-type": "application/json" });
  headers.append("set-cookie", "authjs.session-token=abc; Path=/; HttpOnly");
  return new Response(JSON.stringify(body), { status: 200, headers });
}

beforeEach(() => {
  mockHandlers.GET.mockReset();
  mockHandlers.POST.mockReset();
});

describe("auth route handler", () => {
  test("strips the Google access token from GET /api/auth/session", async () => {
    mockHandlers.GET.mockResolvedValue(jsonResponse(SESSION));

    const response = await GET(new NextRequest("http://localhost/api/auth/session"));

    expect(await response.json()).toEqual({
      user: { id: "user-1", name: "Ada" },
      expires: "2026-10-25T00:00:00.000Z",
    });
    expect(response.headers.get("set-cookie")).toContain("authjs.session-token=abc");
  });

  test("strips it from POST /api/auth/session (session update) too", async () => {
    mockHandlers.POST.mockResolvedValue(jsonResponse(SESSION));

    const response = await POST(
      new NextRequest("http://localhost/api/auth/session", { method: "POST" })
    );

    expect(await response.json()).not.toHaveProperty("accessToken");
  });

  test("leaves other Auth.js endpoints untouched", async () => {
    const original = jsonResponse({ google: { id: "google" } });
    mockHandlers.GET.mockResolvedValue(original);

    const response = await GET(new NextRequest("http://localhost/api/auth/providers"));

    expect(response).toBe(original);
  });
});
