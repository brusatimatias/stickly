import { APICallError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  note: {
    aggregate: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
  $executeRaw: vi.fn(),
  webChatUsage: {
    create: vi.fn(),
    count: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

const mockAuth = vi.hoisted(() => vi.fn());
const mockRevalidatePath = vi.hoisted(() => vi.fn());
const mockGoogle = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
vi.mock("next-intl/server", () => ({ getLocale: async () => "es" }));
vi.mock("@ai-sdk/google", () => ({ google: mockGoogle }));

import { sendChatMessage } from "@/app/actions/chat";

const SESSION = { user: { id: "user-1" } };
const TIME_ZONE = "America/Argentina/Buenos_Aires";
const MESSAGES = [{ role: "user", content: "Recordame mañana llamar al plomero" }];

const USAGE = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};

type Content = Awaited<ReturnType<MockLanguageModelV4["doGenerate"]>>["content"];

function toolCall(input: Record<string, unknown>, toolName = "create_note", id = "call-1"): Content {
  return [{ type: "tool-call", toolCallId: id, toolName, input: JSON.stringify(input) }];
}

function text(value: string): Content {
  return [{ type: "text", text: value }];
}

/** A model that answers each step with the next content in `steps`. */
function mockModel(steps: Content[]) {
  let call = 0;
  const model = new MockLanguageModelV4({
    doGenerate: async () => {
      const content = steps[Math.min(call, steps.length - 1)];
      const isToolStep = content.some((part) => part.type === "tool-call");
      call += 1;
      return {
        content,
        finishReason: { unified: isToolStep ? "tool-calls" : "stop", raw: undefined },
        usage: USAGE,
        warnings: [],
      };
    },
  });
  mockGoogle.mockReturnValue(model);
  return model;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(SESSION);
  mockPrisma.note.aggregate.mockResolvedValue({ _count: 0, _max: { position: null } });
  mockPrisma.$transaction.mockImplementation((callback: (tx: typeof mockPrisma) => unknown) =>
    callback(mockPrisma)
  );
  mockPrisma.webChatUsage.create.mockResolvedValue({ id: "usage-1" });
  mockPrisma.webChatUsage.count.mockResolvedValue(1);
});

describe("sendChatMessage", () => {
  test("throws when unauthenticated, without touching the database or the model", async () => {
    mockAuth.mockResolvedValue(null);
    const model = mockModel([text("hi")]);

    await expect(sendChatMessage({ messages: MESSAGES, timeZone: TIME_ZONE })).rejects.toThrow(
      "UNAUTHORIZED"
    );
    expect(mockPrisma.webChatUsage.create).not.toHaveBeenCalled();
    expect(model.doGenerateCalls).toHaveLength(0);
  });

  test("rejects invalid messages before consuming quota", async () => {
    await expect(
      sendChatMessage({ messages: [{ role: "user", content: "" }], timeZone: TIME_ZONE })
    ).rejects.toThrow("INVALID_CHAT_MESSAGES");
    expect(mockPrisma.webChatUsage.create).not.toHaveBeenCalled();
  });

  test("records usage scoped to the user and prunes rows older than a day", async () => {
    mockModel([text("¿Para qué día?")]);

    await sendChatMessage({ messages: MESSAGES, timeZone: TIME_ZONE });

    expect(mockPrisma.webChatUsage.deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: expect.any(Date) } },
    });
    expect(mockPrisma.webChatUsage.create).toHaveBeenCalledWith({ data: { userId: "user-1" } });
    expect(mockPrisma.webChatUsage.count).toHaveBeenCalledWith({
      where: { userId: "user-1", createdAt: { gte: expect.any(Date) } },
    });
  });

  test.each([
    ["user per-minute", [6, 6, 6], "CHAT_RATE_LIMITED"],
    ["user per-day", [1, 31, 31], "CHAT_DAILY_LIMIT_REACHED"],
    ["global per-day", [1, 1, 201], "CHAT_QUOTA_EXCEEDED"],
  ])("rejects over the %s limit and releases the usage row", async (_, counts, code) => {
    const model = mockModel([text("hi")]);
    for (const count of counts) {
      mockPrisma.webChatUsage.count.mockResolvedValueOnce(count);
    }

    await expect(sendChatMessage({ messages: MESSAGES, timeZone: TIME_ZONE })).rejects.toThrow(code);
    expect(mockPrisma.webChatUsage.deleteMany).toHaveBeenLastCalledWith({
      where: { id: "usage-1", userId: "user-1" },
    });
    expect(model.doGenerateCalls).toHaveLength(0);
  });

  test("creates the note from the tool call and returns the model's reply", async () => {
    const model = mockModel([
      toolCall({ title: "Llamar al plomero", day: "2026-09-27", description: "Pérdida en la cocina" }),
      text("Listo, te lo agendé para mañana domingo."),
    ]);

    const result = await sendChatMessage({ messages: MESSAGES, timeZone: TIME_ZONE });

    expect(mockPrisma.note.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: "Llamar al plomero",
        description: "Pérdida en la cocina",
        location: null,
        kind: "ALL_DAY",
        startsAt: new Date("2026-09-27T00:00:00.000Z"),
        userId: "user-1",
      }),
    });
    expect(result).toEqual({
      reply: "Listo, te lo agendé para mañana domingo.",
      createdNotes: [{ id: expect.any(String), day: "2026-09-27" }],
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/");
    expect(mockGoogle).toHaveBeenCalledWith("gemini-3.5-flash-lite");

    const firstCall = model.doGenerateCalls[0];
    expect(JSON.stringify(firstCall.prompt)).toContain("Reply in Spanish");
    expect(firstCall.tools?.map((toolDef) => toolDef.name)).toEqual([
      "create_note",
      "create_draft_note",
      "list_notes",
    ]);
  });

  test("converts a time the model gives, in the user's zone, to UTC", async () => {
    mockModel([
      toolCall({ title: "Cena", day: "2026-09-27", time: "22:00" }),
      text("Listo."),
    ]);

    const result = await sendChatMessage({ messages: MESSAGES, timeZone: TIME_ZONE });

    expect(mockPrisma.note.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: "TIMED",
        startsAt: new Date("2026-09-28T01:00:00.000Z"),
      }),
    });
    // The board link uses the local day the user asked for, not the UTC one.
    expect(result.createdNotes).toEqual([{ id: expect.any(String), day: "2026-09-27" }]);
  });

  test("returns a recoverable tool error to the model instead of creating the note", async () => {
    const model = mockModel([toolCall({ title: "Llamar al plomero" }), text("¿Para qué día?")]);

    const result = await sendChatMessage({ messages: MESSAGES, timeZone: TIME_ZONE });

    expect(mockPrisma.note.create).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
    expect(result).toEqual({ reply: "¿Para qué día?", createdNotes: [] });
    expect(JSON.stringify(model.doGenerateCalls[1].prompt)).toContain("DAY_REQUIRED");
  });

  test("creates a draft, with no day, from create_draft_note", async () => {
    mockModel([
      toolCall({ title: "Comprar pilas", description: "AA" }, "create_draft_note"),
      text("Listo, quedó en tus borradores."),
    ]);

    const result = await sendChatMessage({
      messages: [{ role: "user", content: "Anotame como borrador comprar pilas AA" }],
      timeZone: TIME_ZONE,
    });

    expect(mockPrisma.note.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ title: "Comprar pilas", isDraft: true, userId: "user-1" }),
    });
    expect(result).toEqual({
      reply: "Listo, quedó en tus borradores.",
      createdNotes: [{ id: expect.any(String), day: null }],
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/");
  });

  test("returns the draft limit to the model as a recoverable error", async () => {
    mockPrisma.note.aggregate.mockResolvedValue({ _count: 4, _max: { position: 3 } });
    const model = mockModel([
      toolCall({ title: "Comprar pilas" }, "create_draft_note"),
      text("Ya tenés 4 borradores."),
    ]);

    const result = await sendChatMessage({ messages: MESSAGES, timeZone: TIME_ZONE });

    expect(mockPrisma.note.create).not.toHaveBeenCalled();
    expect(result).toEqual({ reply: "Ya tenés 4 borradores.", createdNotes: [] });
    expect(JSON.stringify(model.doGenerateCalls[1].prompt)).toContain("DRAFT_LIMIT_REACHED");
  });

  test("hides unexpected tool failures from the model behind a generic code", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockPrisma.note.create.mockRejectedValueOnce(new Error("Unique constraint failed on Note.id"));
    const model = mockModel([
      toolCall({ title: "Llamar al plomero", day: "2026-09-27" }),
      text("No pude guardar la nota, probá de nuevo."),
    ]);

    const result = await sendChatMessage({ messages: MESSAGES, timeZone: TIME_ZONE });

    const secondPrompt = JSON.stringify(model.doGenerateCalls[1].prompt);
    expect(secondPrompt).toContain("NOTE_NOT_SAVED");
    expect(secondPrompt).not.toContain("Unique constraint");
    expect(result).toEqual({ reply: "No pude guardar la nota, probá de nuevo.", createdNotes: [] });
  });

  test("answers from list_notes with every day of the range and no board refresh", async () => {
    mockPrisma.note.findMany.mockResolvedValue([
      {
        id: "note-1",
        title: "Tomar el té",
        location: null,
        description: null,
        kind: "ALL_DAY",
        startsAt: new Date("2026-09-21T00:00:00Z"),
        isDone: false,
        googleEventId: null,
      },
    ]);
    const model = mockModel([
      toolCall({ from: "2026-09-21", to: "2026-09-22", status: "pending" }, "list_notes"),
      text("Lunes: tomar el té\nMartes: nada"),
    ]);

    const result = await sendChatMessage({
      messages: [{ role: "user", content: "¿Qué tengo sin hacer esta semana?" }],
      timeZone: TIME_ZONE,
    });

    expect(mockPrisma.note.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: "user-1", isDraft: false }) })
    );
    const toolResultPrompt = JSON.stringify(model.doGenerateCalls[1].prompt);
    expect(toolResultPrompt).toContain("Tomar el té");
    expect(toolResultPrompt).toContain("2026-09-22");
    expect(result).toEqual({ reply: "Lunes: tomar el té\nMartes: nada", createdNotes: [] });
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  test("returns an invalid list_notes range to the model as a recoverable error", async () => {
    const model = mockModel([
      toolCall({ from: "2026-09-27", to: "2026-09-21" }, "list_notes"),
      text("¿De qué fechas?"),
    ]);

    await sendChatMessage({ messages: MESSAGES, timeZone: TIME_ZONE });

    expect(mockPrisma.note.findMany).not.toHaveBeenCalled();
    expect(JSON.stringify(model.doGenerateCalls[1].prompt)).toContain("INVALID_DATE_RANGE");
  });

  test("hides unexpected list_notes failures behind NOTES_UNAVAILABLE", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockPrisma.note.findMany.mockRejectedValueOnce(new Error("connection terminated unexpectedly"));
    const model = mockModel([toolCall({ from: "2026-09-26" }, "list_notes"), text("Probá de nuevo.")]);

    await sendChatMessage({ messages: MESSAGES, timeZone: TIME_ZONE });

    const secondPrompt = JSON.stringify(model.doGenerateCalls[1].prompt);
    expect(secondPrompt).toContain("NOTES_UNAVAILABLE");
    expect(secondPrompt).not.toContain("connection terminated");
  });

  test("maps a 429 from the provider to CHAT_QUOTA_EXCEEDED", async () => {
    const model = mockModel([text("unused")]);
    model.doGenerate = async () => {
      throw new APICallError({
        message: "Resource exhausted",
        url: "https://generativelanguage.googleapis.com",
        requestBodyValues: {},
        statusCode: 429,
      });
    };

    await expect(sendChatMessage({ messages: MESSAGES, timeZone: TIME_ZONE })).rejects.toThrow(
      "CHAT_QUOTA_EXCEEDED"
    );
  });

  describe("when the model is unavailable (503)", () => {
    const DEFAULT_MODEL = "gemini-main";
    const FALLBACK_MODEL = "gemini-fallback";

    function providerError(statusCode: number) {
      return new APICallError({
        message: "The model is overloaded",
        url: "https://generativelanguage.googleapis.com",
        requestBodyValues: {},
        statusCode,
      });
    }

    /** The main model runs `mainSteps` and then fails with `statusCode`; the fallback answers `fallbackSteps`. */
    function mockModels(mainSteps: Content[], statusCode: number, fallbackSteps: Content[]) {
      const fallback = mockModel(fallbackSteps);
      const main = mockModel(mainSteps);
      let call = 0;
      const generate = main.doGenerate;
      main.doGenerate = async (options) => {
        call += 1;
        if (call > mainSteps.length) {
          throw providerError(statusCode);
        }
        return generate(options);
      };
      mockGoogle.mockImplementation((modelId: string) => (modelId === FALLBACK_MODEL ? fallback : main));
      return { main, fallback };
    }

    beforeEach(() => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.stubEnv("CHAT_MODEL", DEFAULT_MODEL);
      vi.stubEnv("CHAT_FALLBACK_MODEL", FALLBACK_MODEL);
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    test("retries once with the fallback model", async () => {
      const { fallback } = mockModels([], 503, [text("¿Para qué día?")]);

      const result = await sendChatMessage({ messages: MESSAGES, timeZone: TIME_ZONE });

      expect(mockGoogle).toHaveBeenLastCalledWith(FALLBACK_MODEL);
      expect(fallback.doGenerateCalls).toHaveLength(1);
      expect(result).toEqual({ reply: "¿Para qué día?", createdNotes: [] });
    });

    test("retries only once when the fallback model is unavailable too", async () => {
      const { fallback } = mockModels([], 503, [text("unused")]);
      fallback.doGenerate = async () => {
        throw providerError(503);
      };

      await expect(sendChatMessage({ messages: MESSAGES, timeZone: TIME_ZONE })).rejects.toThrow(
        "CHAT_UNAVAILABLE"
      );
      expect(mockGoogle.mock.calls).toEqual([[DEFAULT_MODEL], [FALLBACK_MODEL]]);
    });

    test("fails with CHAT_UNAVAILABLE when no fallback model is configured", async () => {
      vi.stubEnv("CHAT_FALLBACK_MODEL", "");
      const { fallback } = mockModels([], 503, [text("unused")]);

      await expect(sendChatMessage({ messages: MESSAGES, timeZone: TIME_ZONE })).rejects.toThrow(
        "CHAT_UNAVAILABLE"
      );
      expect(fallback.doGenerateCalls).toHaveLength(0);
    });

    test("doesn't retry a 429 with the fallback model", async () => {
      const { fallback } = mockModels([], 429, [text("unused")]);

      await expect(sendChatMessage({ messages: MESSAGES, timeZone: TIME_ZONE })).rejects.toThrow(
        "CHAT_QUOTA_EXCEEDED"
      );
      expect(fallback.doGenerateCalls).toHaveLength(0);
    });

    test("returns the notes already saved instead of retrying or failing", async () => {
      const { fallback } = mockModels(
        [toolCall({ title: "Llamar al plomero", day: "2026-09-30" })],
        503,
        [text("unused")]
      );

      const result = await sendChatMessage({ messages: MESSAGES, timeZone: TIME_ZONE });

      expect(fallback.doGenerateCalls).toHaveLength(0);
      expect(mockPrisma.note.create).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        reply: "",
        createdNotes: [{ id: expect.any(String), day: "2026-09-30" }],
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/");
    });
  });

  test("maps any other provider failure to CHAT_UNAVAILABLE", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const model = mockModel([text("unused")]);
    model.doGenerate = async () => {
      throw new Error("network down");
    };

    await expect(sendChatMessage({ messages: MESSAGES, timeZone: TIME_ZONE })).rejects.toThrow(
      "CHAT_UNAVAILABLE"
    );
  });
});
