import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, test, vi } from "vitest";
import messages from "../../../messages/es.json";
import DayFocusNav from "@/components/board/DayFocusNav";

const DAYS = [
  { key: "2026-09-28", label: "lun 28", weekday: "lu", dayNumber: "28" },
  { key: "2026-09-29", label: "mar 29", weekday: "ma", dayNumber: "29" },
  { key: "2026-09-30", label: "mié 30", weekday: "mi", dayNumber: "30" },
];

function renderNav(focusedDay: string) {
  const onSelect = vi.fn();
  const onExit = vi.fn();
  render(
    <NextIntlClientProvider locale="es" messages={messages}>
      <DayFocusNav
        days={DAYS}
        focusedDay={focusedDay}
        todayKey="2026-09-29"
        onSelect={onSelect}
        onExit={onExit}
      />
    </NextIntlClientProvider>
  );
  return { onSelect, onExit };
}

afterEach(cleanup);

describe("DayFocusNav", () => {
  test("names each day by its full label, whichever layout shows", () => {
    renderNav("2026-09-29");

    const day = screen.getByRole("button", { name: "mar 29" });
    expect(day.getAttribute("aria-current")).toBe("true");
    expect(day.textContent).toContain("ma");
    expect(day.textContent).toContain("29");
  });

  test("jumps to a day and steps to the adjacent ones", () => {
    const { onSelect } = renderNav("2026-09-29");

    fireEvent.click(screen.getByRole("button", { name: "mié 30" }));
    fireEvent.click(screen.getByRole("button", { name: messages.board.previousDay }));
    fireEvent.click(screen.getByRole("button", { name: messages.board.nextDay }));

    expect(onSelect.mock.calls).toEqual([["2026-09-30"], ["2026-09-28"], ["2026-09-30"]]);
  });

  test("disables stepping past the week's ends", () => {
    const isDisabled = (name: string) =>
      (screen.getByRole("button", { name }) as HTMLButtonElement).disabled;

    renderNav("2026-09-28");
    expect(isDisabled(messages.board.previousDay)).toBe(true);
    expect(isDisabled(messages.board.nextDay)).toBe(false);

    cleanup();
    renderNav("2026-09-30");
    expect(isDisabled(messages.board.previousDay)).toBe(false);
    expect(isDisabled(messages.board.nextDay)).toBe(true);
  });

  test("goes back to the week", () => {
    const { onExit } = renderNav("2026-09-28");

    fireEvent.click(screen.getByRole("button", { name: messages.board.backToWeek }));

    expect(onExit).toHaveBeenCalled();
  });
});
