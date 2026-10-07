import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import messages from "../../../messages/es.json";
import TimePicker from "@/components/board/TimePicker";
import { TimeZoneProvider } from "@/components/board/TimeZoneContext";

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
  vi.useRealTimers();
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

  test("starts at the current time in the board's zone when no time is set", () => {
    // 17:42 UTC is 14:42 in Buenos Aires.
    vi.useFakeTimers({ now: new Date("2026-10-07T17:42:00Z"), toFake: ["Date"] });
    const scrolled: string[] = [];
    Element.prototype.scrollIntoView = vi.fn(function (this: HTMLElement) {
      scrolled.push(this.dataset.value!);
    });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });

    render(
      <NextIntlClientProvider locale="es" messages={messages}>
        <TimeZoneProvider value="America/Argentina/Buenos_Aires">
          <TimePicker value="" onChange={() => {}} />
        </TimeZoneProvider>
      </NextIntlClientProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: messages.board.time }));

    expect(scrolled).toEqual(["14", "42"]);
  });
});
