import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import messages from "../../messages/es.json";

const mockSetTheme = vi.hoisted(() => vi.fn());
vi.mock("@/app/actions/theme", () => ({ setTheme: mockSetTheme }));

import ThemeToggle from "@/components/ThemeToggle";

function renderToggle() {
  render(
    <NextIntlClientProvider locale="es" messages={messages}>
      <ThemeToggle />
    </NextIntlClientProvider>
  );
  return screen.getByRole("button");
}

beforeEach(() => {
  vi.clearAllMocks();
  document.documentElement.className = "light";
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.documentElement.className = "";
});

describe("ThemeToggle", () => {
  test("switches the class right away and saves the theme in a single action", async () => {
    let finish: () => void = () => {};
    mockSetTheme.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    const toggle = renderToggle();

    await act(async () => fireEvent.click(toggle));

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.classList.contains("light")).toBe(false);
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
    expect(toggle.getAttribute("aria-disabled")).toBe("true");

    // Ignored while the cookie is being saved.
    await act(async () => fireEvent.click(toggle));
    expect(mockSetTheme).toHaveBeenCalledTimes(1);

    await act(async () => finish());
    expect(toggle.getAttribute("aria-disabled")).toBe("false");
  });
});
