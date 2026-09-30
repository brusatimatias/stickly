import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  whatsAppInboundMessage: { create: vi.fn(), count: vi.fn(), deleteMany: vi.fn() },
  whatsAppLinkCode: { findUnique: vi.fn(), deleteMany: vi.fn() },
  whatsAppMessage: { deleteMany: vi.fn(), findMany: vi.fn(), createMany: vi.fn() },
  $transaction: vi.fn(),
}));
const mockSend = vi.hoisted(() => vi.fn());
const mockConsumeQuota = vi.hoisted(() => vi.fn());
const mockRunChatTurn = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/whatsappApi", () => ({ sendWhatsAppText: mockSend }));
vi.mock("@/lib/chatAssistant", () => ({
  consumeChatQuota: mockConsumeQuota,
  runChatTurn: mockRunChatTurn,
}));

import {
  HISTORY_IDLE_MS,
  MAX_LINK_ATTEMPTS_PER_HOUR,
  WHATSAPP_REPLIES,
  handleInboundMessage,
} from "@/lib/whatsappInbound";
import { hashLinkCode } from "@/lib/whatsappLink";

const FROM = "5491122334455";

function message(text: string | null, wamid = "wamid.1") {
  return { wamid, from: FROM, text };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AUTH_SECRET", "test-secret");
  mockPrisma.whatsAppInboundMessage.create.mockResolvedValue({});
  mockPrisma.whatsAppInboundMessage.count.mockResolvedValue(1);
  mockPrisma.user.findUnique.mockResolvedValue({ id: "user-1", timeZone: "America/Argentina/Buenos_Aires" });
  mockPrisma.whatsAppMessage.findMany.mockResolvedValue([]);
  mockConsumeQuota.mockResolvedValue(undefined);
  mockRunChatTurn.mockResolvedValue({ reply: "¿Para qué día?", createdNotes: [] });
  mockPrisma.whatsAppLinkCode.findUnique.mockResolvedValue({
    userId: "user-2",
    expiresAt: new Date(Date.now() + 60_000),
  });
  mockPrisma.whatsAppLinkCode.deleteMany.mockResolvedValue({ count: 1 });
  mockPrisma.$transaction.mockImplementation((callback: (tx: typeof mockPrisma) => unknown) =>
    callback(mockPrisma)
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("handleInboundMessage", () => {
  test("skips a message it already handled", async () => {
    mockPrisma.whatsAppInboundMessage.create.mockRejectedValue(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" })
    );

    await handleInboundMessage(message("hola"));

    expect(mockSend).not.toHaveBeenCalled();
  });

  test("records each message, marking link codes as attempts", async () => {
    await handleInboundMessage(message("hola"));
    await handleInboundMessage(message("123 456", "wamid.2"));

    expect(mockPrisma.whatsAppInboundMessage.create.mock.calls).toEqual([
      [{ data: { wamid: "wamid.1", from: FROM, isLinkAttempt: false } }],
      [{ data: { wamid: "wamid.2", from: FROM, isLinkAttempt: true } }],
    ]);
  });

  describe("prunes everyone's expired conversation turns", () => {
    const prune = { where: { createdAt: { lt: expect.any(Date) } } };

    test.each([
      ["a linked user's message", "hola", { id: "user-1", timeZone: null }],
      ["an unlinked number's message", "hola", null],
      ["a link code", "123456", null],
    ])("on %s", async (_, text, user) => {
      mockPrisma.user.findUnique.mockResolvedValue(user);

      await handleInboundMessage(message(text));

      expect(mockPrisma.whatsAppMessage.deleteMany).toHaveBeenCalledWith(prune);
    });

    test("with the idle window as the cutoff", async () => {
      vi.useFakeTimers({ now: new Date("2026-09-30T12:00:00Z") });
      try {
        await handleInboundMessage(message("hola"));
      } finally {
        vi.useRealTimers();
      }

      expect(mockPrisma.whatsAppMessage.deleteMany).toHaveBeenCalledWith({
        where: { createdAt: { lt: new Date(Date.parse("2026-09-30T12:00:00Z") - HISTORY_IDLE_MS) } },
      });
    });
  });

  test("answers an unlinked number without calling anything else", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await handleInboundMessage(message("recordame algo"));

    expect(mockSend).toHaveBeenCalledWith(FROM, WHATSAPP_REPLIES.notLinked);
  });

  test("asks for text when a linked user sends something else", async () => {
    await handleInboundMessage(message(null));

    expect(mockSend).toHaveBeenCalledWith(FROM, WHATSAPP_REPLIES.textOnly);
  });

  describe("with a link code", () => {
    test("links the number to the code's user, moving it from anyone else", async () => {
      await handleInboundMessage(message("123456"));

      expect(mockPrisma.whatsAppLinkCode.findUnique).toHaveBeenCalledWith({
        where: { codeHash: hashLinkCode("123456") },
      });
      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        where: { whatsappNumber: FROM, NOT: { id: "user-2" } },
        data: { whatsappNumber: null },
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-2" },
        data: { whatsappNumber: FROM },
      });
      expect(mockPrisma.whatsAppLinkCode.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user-2", codeHash: hashLinkCode("123456"), expiresAt: { gt: expect.any(Date) } },
      });
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith(FROM, WHATSAPP_REPLIES.linked);
    });

    test("rejects an unknown code", async () => {
      mockPrisma.whatsAppLinkCode.findUnique.mockResolvedValue(null);

      await handleInboundMessage(message("123456"));

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockSend).toHaveBeenCalledWith(FROM, WHATSAPP_REPLIES.invalidCode);
    });

    test("rejects an expired code", async () => {
      mockPrisma.whatsAppLinkCode.findUnique.mockResolvedValue({
        userId: "user-2",
        expiresAt: new Date(Date.now() - 1),
      });

      await handleInboundMessage(message("123456"));

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockSend).toHaveBeenCalledWith(FROM, WHATSAPP_REPLIES.invalidCode);
    });

    test("doesn't link when another message used the code first", async () => {
      mockPrisma.whatsAppLinkCode.deleteMany.mockResolvedValue({ count: 0 });

      await handleInboundMessage(message("123456"));

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect(mockSend).toHaveBeenCalledWith(FROM, WHATSAPP_REPLIES.invalidCode);
    });

    test("stops checking codes after too many attempts from the number", async () => {
      mockPrisma.whatsAppInboundMessage.count.mockResolvedValue(MAX_LINK_ATTEMPTS_PER_HOUR + 1);

      await handleInboundMessage(message("123456"));

      expect(mockPrisma.whatsAppInboundMessage.count).toHaveBeenCalledWith({
        where: { from: FROM, isLinkAttempt: true, createdAt: { gte: expect.any(Date) } },
      });
      expect(mockPrisma.whatsAppLinkCode.findUnique).not.toHaveBeenCalled();
      expect(mockSend).toHaveBeenCalledWith(FROM, WHATSAPP_REPLIES.tooManyAttempts);
    });
  });

  describe("from a linked user", () => {
    test("answers with the assistant, in the user's zone and language, and keeps the turn", async () => {
      // Newest first, as the query returns them.
      mockPrisma.whatsAppMessage.findMany.mockResolvedValue([
        { role: "ASSISTANT", content: "¿Para qué día?" },
        { role: "USER", content: "Recordame llamar al plomero" },
      ]);
      mockRunChatTurn.mockResolvedValue({ reply: "Listo, el viernes.", createdNotes: [{ id: "n", day: "2026-10-02" }] });

      await handleInboundMessage(message("el viernes"));

      expect(mockConsumeQuota).toHaveBeenCalledWith("user-1");
      expect(mockRunChatTurn).toHaveBeenCalledWith({
        userId: "user-1",
        messages: [
          { role: "user", content: "Recordame llamar al plomero" },
          { role: "assistant", content: "¿Para qué día?" },
          { role: "user", content: "el viernes" },
        ],
        timeZone: "America/Argentina/Buenos_Aires",
        locale: null,
      });
      const [{ data }] = mockPrisma.whatsAppMessage.createMany.mock.calls[0];
      expect(data).toMatchObject([
        { userId: "user-1", role: "USER", content: "el viernes" },
        { userId: "user-1", role: "ASSISTANT", content: "Listo, el viernes." },
      ]);
      expect(data[1].createdAt.getTime()).toBeGreaterThan(data[0].createdAt.getTime());
      expect(mockSend).toHaveBeenCalledWith(FROM, "Listo, el viernes.");
    });

    test("falls back to UTC without a stored zone", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: "user-1", timeZone: null });

      await handleInboundMessage(message("hola"));

      expect(mockRunChatTurn).toHaveBeenCalledWith(expect.objectContaining({ timeZone: "UTC" }));
    });

    test("confirms saved notes when the model has no reply", async () => {
      mockRunChatTurn.mockResolvedValue({ reply: "", createdNotes: [{ id: "n", day: "2026-10-02" }] });

      await handleInboundMessage(message("anotá algo el viernes"));

      expect(mockSend).toHaveBeenCalledWith(FROM, WHATSAPP_REPLIES.noteCreated);
    });

    test("rejects a message that's too long before spending quota", async () => {
      await handleInboundMessage(message("a".repeat(501)));

      expect(mockConsumeQuota).not.toHaveBeenCalled();
      expect(mockSend).toHaveBeenCalledWith(FROM, WHATSAPP_REPLIES.tooLong);
    });

    test.each([
      ["CHAT_RATE_LIMITED", WHATSAPP_REPLIES.rateLimited],
      ["CHAT_DAILY_LIMIT_REACHED", WHATSAPP_REPLIES.dailyLimit],
      ["CHAT_QUOTA_EXCEEDED", WHATSAPP_REPLIES.unavailable],
    ])("answers %s without calling the model or keeping the turn", async (code, reply) => {
      mockConsumeQuota.mockRejectedValue(new Error(code));

      await handleInboundMessage(message("hola"));

      expect(mockRunChatTurn).not.toHaveBeenCalled();
      expect(mockPrisma.whatsAppMessage.createMany).not.toHaveBeenCalled();
      expect(mockSend).toHaveBeenCalledWith(FROM, reply);
    });

    test("logs unexpected failures and answers that the assistant is unavailable", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      mockRunChatTurn.mockRejectedValue(new Error("boom"));

      await handleInboundMessage(message("hola"));

      expect(consoleError).toHaveBeenCalled();
      expect(mockPrisma.whatsAppMessage.createMany).not.toHaveBeenCalled();
      expect(mockSend).toHaveBeenCalledWith(FROM, WHATSAPP_REPLIES.unavailable);
    });
  });
});
