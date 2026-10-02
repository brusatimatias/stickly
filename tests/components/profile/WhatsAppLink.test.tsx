import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import messages from "../../../messages/es.json";

const mockCreateCode = vi.hoisted(() => vi.fn());
const mockUnlink = vi.hoisted(() => vi.fn());
const mockRefresh = vi.hoisted(() => vi.fn());

vi.mock("@/app/actions/whatsapp", () => ({
  createWhatsAppLinkCode: mockCreateCode,
  unlinkWhatsApp: mockUnlink,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mockRefresh }) }));

import WhatsAppLink from "@/components/profile/WhatsAppLink";

const BOT_NUMBER = "15551833156";
const t = messages.profile.whatsapp;

function renderLink(linkedNumber: string | null) {
  render(
    <NextIntlClientProvider locale="es" messages={messages} timeZone="UTC">
      <WhatsAppLink linkedNumber={linkedNumber} botNumber={BOT_NUMBER} />
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("WhatsAppLink", () => {
  test("shows the code, where to send it and a WhatsApp link with it typed", async () => {
    mockCreateCode.mockResolvedValue({ code: "012345", expiresAt: new Date("2026-09-29T15:10:00Z") });
    renderLink(null);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: t.link }));
    });

    expect(screen.getByText("012345")).toBeTruthy();
    expect(screen.getByText(/\+15551833156/)).toBeTruthy();
    expect(screen.getByRole("link", { name: t.openWhatsApp }).getAttribute("href")).toBe(
      "https://wa.me/15551833156?text=012345"
    );

    fireEvent.click(screen.getByRole("button", { name: t.sent }));
    expect(mockRefresh).toHaveBeenCalled();
  });

  test("shows the linked number and unlinks it", async () => {
    mockUnlink.mockResolvedValue(undefined);
    renderLink("5491122334455");

    expect(screen.getByText(/\+5491122334455/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: t.unlink }));
    expect(mockUnlink).not.toHaveBeenCalled();

    const dialog = screen.getByRole("alertdialog");
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: t.unlink }));
    });

    expect(mockUnlink).toHaveBeenCalled();
    expect(screen.getByText(t.unlinked)).toBeTruthy();
  });

  test("keeps the number linked when the unlink is cancelled", () => {
    renderLink("5491122334455");

    fireEvent.click(screen.getByRole("button", { name: t.unlink }));
    fireEvent.click(screen.getByRole("button", { name: messages.board.cancel }));

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(mockUnlink).not.toHaveBeenCalled();
  });

  test("shows a generic error when the code can't be generated", async () => {
    mockCreateCode.mockRejectedValue(new Error("boom"));
    renderLink(null);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: t.link }));
    });

    expect(screen.getByText(messages.errors.GENERIC)).toBeTruthy();
  });
});
