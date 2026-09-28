import { DndContext } from "@dnd-kit/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, test, vi } from "vitest";
import messages from "../../../messages/es.json";

vi.mock("@/app/actions/notes", () => ({
  createDraftNote: vi.fn(),
  updateDraftNote: vi.fn(),
  deleteNote: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import DraftPanel from "@/components/board/DraftPanel";
import type { NoteDTO } from "@/components/board/types";

function drafts(count: number): NoteDTO[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `draft-${index}`,
    title: `Draft ${index}`,
    location: null,
    description: null,
    time: null,
    isDone: false,
    googleEventId: null,
  }));
}

function renderPanel(notes: NoteDTO[]) {
  render(
    <NextIntlClientProvider locale="es" messages={messages}>
      <DndContext>
        <DraftPanel notes={notes} />
      </DndContext>
    </NextIntlClientProvider>
  );
}

const NEW_DRAFT = messages.board.newDraftNote;

afterEach(cleanup);

describe("DraftPanel", () => {
  test("lists every draft and offers a new one below the limit", () => {
    renderPanel(drafts(3));

    expect(screen.getByText("Draft 0")).toBeTruthy();
    expect(screen.getByText("Draft 2")).toBeTruthy();
    expect(screen.getByRole("button", { name: NEW_DRAFT })).toBeTruthy();
  });

  test("hides the new draft button at four drafts", () => {
    renderPanel(drafts(4));

    expect(screen.getByText("Draft 3")).toBeTruthy();
    expect(screen.queryByRole("button", { name: NEW_DRAFT })).toBeNull();
  });

  test("hides the new draft button while one is being written", () => {
    renderPanel(drafts(0));

    fireEvent.click(screen.getByRole("button", { name: NEW_DRAFT }));

    expect(screen.getByLabelText(messages.board.titlePlaceholder)).toBeTruthy();
    expect(screen.queryByRole("button", { name: NEW_DRAFT })).toBeNull();
  });
});
