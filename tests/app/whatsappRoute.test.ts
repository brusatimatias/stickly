import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mockHandle = vi.hoisted(() => vi.fn());
const afterCallbacks = vi.hoisted(() => [] as (() => Promise<void>)[]);

vi.mock("@/lib/whatsappInbound", () => ({ handleInboundMessage: mockHandle }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (callback: () => Promise<void>) => afterCallbacks.push(callback),
}));

import { GET, POST } from "@/app/api/whatsapp/route";

const URL = "https://stickly.test/api/whatsapp";
const SECRET = "app-secret";

function post(body: string, signature?: string) {
  return new NextRequest(URL, {
    method: "POST",
    body,
    headers: {
      "x-hub-signature-256":
        signature ?? `sha256=${createHmac("sha256", SECRET).update(body).digest("hex")}`,
    },
  });
}

const TEXT_MESSAGE = {
  entry: [
    {
      changes: [
        {
          field: "messages",
          value: { messages: [{ id: "wamid.1", from: "1", type: "text", text: { body: "hola" } }] },
        },
      ],
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  afterCallbacks.length = 0;
  vi.stubEnv("WHATSAPP_VERIFY_TOKEN", "verify-me");
  vi.stubEnv("WHATSAPP_APP_SECRET", SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/whatsapp", () => {
  test("echoes the challenge when the verify token matches", async () => {
    const response = GET(
      new NextRequest(`${URL}?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=42`)
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("42");
  });

  test("refuses another token", () => {
    const response = GET(
      new NextRequest(`${URL}?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=42`)
    );

    expect(response.status).toBe(403);
  });

  test("refuses everything when no token is configured", () => {
    vi.stubEnv("WHATSAPP_VERIFY_TOKEN", "");
    const response = GET(new NextRequest(`${URL}?hub.mode=subscribe&hub.verify_token=&hub.challenge=42`));

    expect(response.status).toBe(403);
  });
});

describe("POST /api/whatsapp", () => {
  test("answers 200 and handles the messages afterwards", async () => {
    const response = await POST(post(JSON.stringify(TEXT_MESSAGE)));

    expect(response.status).toBe(200);
    expect(mockHandle).not.toHaveBeenCalled();

    await Promise.all(afterCallbacks.map((callback) => callback()));
    expect(mockHandle).toHaveBeenCalledWith({ wamid: "wamid.1", from: "1", text: "hola" });
  });

  test("rejects a request without a valid signature", async () => {
    const response = await POST(post(JSON.stringify(TEXT_MESSAGE), "sha256=" + "0".repeat(64)));

    expect(response.status).toBe(401);
    expect(afterCallbacks).toHaveLength(0);
  });

  test("keeps going when a message fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockHandle.mockRejectedValueOnce(new Error("db down"));
    const twoMessages = structuredClone(TEXT_MESSAGE);
    twoMessages.entry[0].changes[0].value.messages.push({
      id: "wamid.2",
      from: "1",
      type: "text",
      text: { body: "chau" },
    });

    await POST(post(JSON.stringify(twoMessages)));
    await Promise.all(afterCallbacks.map((callback) => callback()));

    expect(mockHandle).toHaveBeenCalledTimes(2);
  });
});
