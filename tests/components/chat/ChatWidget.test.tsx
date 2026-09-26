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

afterEach(cleanup);

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

  test("falls back to a generic confirmation when the model returns no text", async () => {
    mockSendChatMessage.mockResolvedValue({
      reply: "",
      createdNotes: [{ id: "note-1", day: "2026-09-27" }],
    });
    renderWidget();

    await sendMessage("Recordame mañana llamar al plomero");

    expect(screen.getByText(messages.chat.noteCreated)).toBeTruthy();
  });
});
