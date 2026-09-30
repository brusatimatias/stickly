import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import messages from "../../../messages/es.json";
import TimePicker from "@/components/board/TimePicker";

function openPickerAt(left: number) {
  render(
    <NextIntlClientProvider locale="es" messages={messages}>
      <TimePicker value="" onChange={() => {}} />
    </NextIntlClientProvider>
  );
  const button = screen.getByRole("button", { name: messages.board.time });
  vi.spyOn(button, "getBoundingClientRect").mockReturnValue({ left, bottom: 100 } as DOMRect);
  fireEvent.click(button);
  return document.querySelector<HTMLElement>("[data-note-popover]")!;
}

beforeEach(() => {
  vi.stubGlobal("innerWidth", 375);
  // jsdom doesn't implement scrolling.
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("TimePicker", () => {
  test("opens the popover under the button", () => {
    const popover = openPickerAt(40);

    expect(popover.style.left).toBe("40px");
    expect(popover.style.top).toBe("106px");
  });

  test("keeps the popover inside the viewport near the right edge", () => {
    const popover = openPickerAt(330);

    // 375 wide viewport - 112 px popover - 8 px margin.
    expect(popover.style.left).toBe("255px");
  });
});
