import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  whatsAppInboundMessage: { create: vi.fn(), count: vi.fn(), deleteMany: vi.fn() },
  whatsAppLinkCode: { findUnique: vi.fn(), deleteMany: vi.fn() },
  whatsAppMessage: { deleteMany: vi.fn() },
  $transaction: vi.fn(),
}));
const mockSend = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/whatsappApi", () => ({ sendWhatsAppText: mockSend }));

import {
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
  mockPrisma.user.findUnique.mockResolvedValue({ id: "user-1" });
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
});
