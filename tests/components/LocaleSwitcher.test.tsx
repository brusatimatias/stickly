import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import messages from "../../messages/es.json";

const mockSetLocale = vi.hoisted(() => vi.fn());
vi.mock("@/app/actions/locale", () => ({ setLocale: mockSetLocale }));

import LocaleSwitcher from "@/components/LocaleSwitcher";

function renderSwitch() {
  render(
    <NextIntlClientProvider locale="es" messages={messages}>
      <LocaleSwitcher />
    </NextIntlClientProvider>
  );
  return screen.getByRole("switch", { name: messages.common.spanishLanguage });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("LocaleSwitcher", () => {
  test("is a switch that is on for Spanish", () => {
    const toggle = renderSwitch();

    expect(toggle.getAttribute("aria-checked")).toBe("true");
    expect(toggle.getAttribute("aria-disabled")).toBe("false");
  });

  test("moves to English right away and stays busy until the action returns", async () => {
    let finish: () => void = () => {};
    mockSetLocale.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    const toggle = renderSwitch();

    await act(async () => fireEvent.click(toggle));

    expect(mockSetLocale).toHaveBeenCalledWith("en");
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(toggle.getAttribute("aria-disabled")).toBe("true");

    // A second click while the page is being translated is ignored.
    await act(async () => fireEvent.click(toggle));
    expect(mockSetLocale).toHaveBeenCalledTimes(1);

    await act(async () => finish());
    expect(toggle.getAttribute("aria-disabled")).toBe("false");
  });
});
