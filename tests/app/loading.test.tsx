import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, test, vi } from "vitest";
import messages from "../../messages/es.json";

vi.mock("@/app/actions/theme", () => ({ setTheme: vi.fn() }));
vi.mock("@/app/actions/locale", () => ({ setLocale: vi.fn() }));

import BoardLoading from "@/app/loading";
import ProfileLoading from "@/app/profile/loading";

function renderWithMessages(ui: React.ReactNode) {
  render(
    <NextIntlClientProvider locale="es" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  );
}

afterEach(cleanup);

describe("loading states", () => {
  test("the board announces it's loading, in the user's language", () => {
    renderWithMessages(<BoardLoading />);

    expect(screen.getByRole("status").textContent).toBe(messages.board.loadingBoard);
  });

  test("the profile keeps a working way back while its card loads", () => {
    renderWithMessages(<ProfileLoading />);

    expect(screen.getByRole("status").textContent).toBe(messages.profile.loadingProfile);
    const back = screen.getByRole("link", { name: messages.profile.backToBoard });
    expect(back.getAttribute("href")).toBe("/");
  });
});
