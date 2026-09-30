import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import messages from "../../../messages/es.json";

const mockSendChatMessage = vi.hoisted(() => vi.fn());
const mockRefresh = vi.hoisted(() => vi.fn());

vi.mock("@/app/actions/chat", () => ({ sendChatMessage: mockSendChatMessage }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mockRefresh }) }));

import ChatWidget from "@/components/chat/ChatWidget";

const WEEK_DAYS = ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27"];

function renderWidget() {
  render(
    <NextIntlClientProvider locale="es" messages={messages}>
      <ChatWidget weekDays={WEEK_DAYS} />
    </NextIntlClientProvider>
  );
  fireEvent.click(screen.getByRole("button", { name: "Abrir asistente" }));
}

async function sendMessage(text: string) {
  fireEvent.change(screen.getByLabelText(messages.chat.placeholder), { target: { value: text } });
  await act(async () => {
    fireEvent.keyDown(screen.getByLabelText(messages.chat.placeholder), { key: "Enter" });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom doesn't implement scrolling.
  Element.prototype.scrollTo = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ChatWidget", () => {
  test("sends the conversation with the user's time zone and shows the reply", async () => {
    mockSendChatMessage.mockResolvedValue({
      reply: "Listo, lo agendé para mañana domingo.",
      createdNotes: [{ id: "note-1", day: "2026-09-27" }],
    });
    renderWidget();

    await sendMessage("Recordame mañana llamar al plomero");

    expect(mockSendChatMessage).toHaveBeenCalledWith({
      messages: [{ role: "user", content: "Recordame mañana llamar al plomero" }],
      timeZone: expect.any(String),
    });
    expect(screen.getByText("Recordame mañana llamar al plomero")).toBeTruthy();
    expect(screen.getByText("Listo, lo agendé para mañana domingo.")).toBeTruthy();
    expect(mockRefresh).toHaveBeenCalled();
    // The note is in the week on screen, so there's no link to another week.
    expect(screen.queryByRole("link")).toBeNull();
  });

  test("sends the previous turns on the next message", async () => {
    mockSendChatMessage
      .mockResolvedValueOnce({ reply: "¿Para qué día?", createdNotes: [] })
      .mockResolvedValueOnce({ reply: "Listo.", createdNotes: [{ id: "note-1", day: "2026-09-27" }] });
    renderWidget();

    await sendMessage("Recordame llamar al plomero");
    await sendMessage("Mañana");

    expect(mockSendChatMessage).toHaveBeenLastCalledWith({
      messages: [
        { role: "user", content: "Recordame llamar al plomero" },
        { role: "assistant", content: "¿Para qué día?" },
        { role: "user", content: "Mañana" },
      ],
      timeZone: expect.any(String),
    });
  });

  test("links to the week of a note created outside the week on screen", async () => {
    mockSendChatMessage.mockResolvedValue({
      reply: "Listo.",
      createdNotes: [{ id: "note-1", day: "2026-10-02" }],
    });
    renderWidget();

    await sendMessage("Recordame el viernes comprar el regalo");

    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/?week=2026-09-28");
  });

  test("refreshes the board for a draft without linking to any week", async () => {
    mockSendChatMessage.mockResolvedValue({
      reply: "Listo, quedó en tus borradores.",
      createdNotes: [{ id: "draft-1", day: null }],
    });
    renderWidget();

    await sendMessage("Anotame como borrador comprar pilas");

    expect(screen.getByText("Listo, quedó en tus borradores.")).toBeTruthy();
    expect(mockRefresh).toHaveBeenCalled();
    expect(screen.queryByRole("link")).toBeNull();
  });

  test("shows the translated error and gives the text back for a retry", async () => {
    mockSendChatMessage.mockRejectedValue(new Error("CHAT_RATE_LIMITED"));
    renderWidget();

    await sendMessage("Recordame mañana llamar al plomero");

    expect(screen.getByRole("alert").textContent).toBe(messages.errors.CHAT_RATE_LIMITED);
    const input = screen.getByLabelText(messages.chat.placeholder) as HTMLTextAreaElement;
    expect(input.value).toBe("Recordame mañana llamar al plomero");
    expect(screen.queryByText("Recordame mañana llamar al plomero", { selector: "p" })).toBeNull();
  });

  test("fills the input with an example without sending it", () => {
    renderWidget();

    fireEvent.click(screen.getByRole("button", { name: messages.chat.exampleWeek }));

    const input = screen.getByLabelText(messages.chat.placeholder) as HTMLTextAreaElement;
    expect(input.value).toBe(messages.chat.exampleWeek);
    expect(mockSendChatMessage).not.toHaveBeenCalled();
  });

  test("closes when clicking the dimmed backdrop", () => {
    renderWidget();
    expect(screen.getByRole("region", { name: messages.chat.title })).toBeTruthy();

    fireEvent.click(document.querySelector('[aria-hidden="true"].fixed.inset-0')!);

    expect(screen.queryByRole("region", { name: messages.chat.title })).toBeNull();
  });

  test("scrolls to the latest message when reopening the panel", async () => {
    mockSendChatMessage.mockResolvedValue({ reply: "¿Para qué día?", createdNotes: [] });
    renderWidget();
    await sendMessage("Recordame llamar al plomero");

    fireEvent.click(screen.getByRole("button", { name: messages.chat.close, expanded: true }));
    vi.mocked(Element.prototype.scrollTo).mockClear();
    fireEvent.click(screen.getByRole("button", { name: messages.chat.open }));

    expect(Element.prototype.scrollTo).toHaveBeenCalledWith({ top: expect.any(Number) });
    expect(screen.getByText("¿Para qué día?")).toBeTruthy();
  });

  test("falls back to a generic confirmation when the model returns no text", async () => {
    mockSendChatMessage.mockResolvedValue({
      reply: "",
      createdNotes: [{ id: "note-1", day: "2026-09-27" }],
    });
    renderWidget();

    await sendMessage("Recordame mañana llamar al plomero");

    expect(screen.getByText(messages.chat.noteCreated)).toBeTruthy();
  });

  test("announces the conversation as a polite live log", () => {
    renderWidget();

    const log = screen.getByRole("log");
    expect(log.getAttribute("aria-live")).toBe("polite");
  });

  test("gives focus back to the launcher when the panel closes", () => {
    renderWidget();
    expect(document.activeElement).toBe(screen.getByLabelText(messages.chat.placeholder));

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("region", { name: messages.chat.title })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: messages.chat.open }));
  });

  test("keeps the panel mounted until its exit animation ends", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
    renderWidget();

    fireEvent.click(screen.getByRole("button", { name: messages.chat.close, expanded: true }));

    const panel = screen.getByRole("region", { name: messages.chat.title, hidden: true });
    expect(panel.hasAttribute("inert")).toBe(true);
    // jsdom has no AnimationEvent, so React listens for the prefixed name.
    fireEvent(panel, new Event("webkitAnimationEnd", { bubbles: true }));
    expect(screen.queryByRole("region", { name: messages.chat.title, hidden: true })).toBeNull();
  });

  test("shows the character counter only past 80% of the limit", () => {
    renderWidget();
    const input = screen.getByLabelText(messages.chat.placeholder);

    fireEvent.change(input, { target: { value: "a".repeat(400) } });
    expect(screen.queryByText("400 / 500")).toBeNull();
    expect(input.getAttribute("aria-describedby")).toBeNull();

    fireEvent.change(input, { target: { value: "a".repeat(401) } });
    const counter = screen.getByText("401 / 500");
    expect(input.getAttribute("aria-describedby")).toBe(counter.id);
  });

  test("shows a typing indicator while waiting for the reply", async () => {
    let resolveReply: (value: unknown) => void = () => {};
    mockSendChatMessage.mockReturnValue(new Promise((resolve) => (resolveReply = resolve)));
    renderWidget();

    await sendMessage("Recordame mañana llamar al plomero");
    expect(screen.getByText(messages.chat.thinking)).toBeTruthy();

    await act(async () => resolveReply({ reply: "¿A qué hora?", createdNotes: [] }));
    expect(screen.queryByText(messages.chat.thinking)).toBeNull();
  });
});
