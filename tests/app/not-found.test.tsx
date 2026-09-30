import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, test } from "vitest";
import messages from "../../messages/es.json";
import NotFound from "@/app/not-found";

afterEach(cleanup);

describe("NotFound", () => {
  test("explains the page doesn't exist and links back to the board", () => {
    render(
      <NextIntlClientProvider locale="es" messages={messages}>
        <NotFound />
      </NextIntlClientProvider>
    );

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(messages.notFound.title);
    expect(screen.getByText(messages.notFound.message)).toBeTruthy();
    const link = screen.getByRole("link", { name: messages.notFound.backToBoard });
    expect(link.getAttribute("href")).toBe("/");
  });
});
