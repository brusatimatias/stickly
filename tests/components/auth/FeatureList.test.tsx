import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, test } from "vitest";
import messages from "../../../messages/es.json";
import FeatureList from "@/components/auth/FeatureList";

const t = messages.auth;

afterEach(cleanup);

describe("FeatureList", () => {
  test("lists the board, drafts, the assistant and WhatsApp in order", () => {
    render(
      <NextIntlClientProvider locale="es" messages={messages} timeZone="UTC">
        <FeatureList />
      </NextIntlClientProvider>
    );

    const items = screen.getAllByRole("listitem").map((item) => item.textContent);
    expect(items).toEqual([
      t.featureBoard,
      t.featureDrag,
      t.featureCalendar,
      t.featureDrafts,
      t.featureChat,
      t.featureWhatsApp,
    ]);
  });
});
