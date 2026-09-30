import { DndContext } from "@dnd-kit/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, test, vi } from "vitest";
import messages from "../../../messages/es.json";

vi.mock("@/app/actions/notes", () => ({
  createNote: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
  toggleNoteDone: vi.fn(),
}));
vi.mock("@/app/actions/calendar", () => ({ addNoteToGoogleCalendar: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import DayColumn from "@/components/board/DayColumn";
import type { NoteDTO } from "@/components/board/types";

const DAY = { key: "2026-10-01", label: "jue 1" };
const t = messages.board;

const NOTE: NoteDTO = {
  id: "note-1",
  title: "Llamar al plomero",
  location: null,
  description: null,
  time: "10:00",
  isDone: false,
  googleEventId: null,
};

function renderColumn(notes: NoteDTO[]) {
  render(
    <NextIntlClientProvider locale="es" messages={messages} timeZone="UTC">
      <DndContext>
        <DayColumn day={DAY} notes={notes} newNoteIds={new Set()} todayKey="2026-09-30" />
      </DndContext>
    </NextIntlClientProvider>
  );
}

afterEach(cleanup);

describe("DayColumn", () => {
  test("offers a card-sized placeholder that opens a new note on an empty day", () => {
    renderColumn([]);

    // The header's "+" has the same name; the placeholder is the one with visible text.
    fireEvent.click(screen.getByText(t.addNote));

    expect(screen.getByLabelText(t.titlePlaceholder)).toBeTruthy();
    expect(screen.queryByText(t.addNote)).toBeNull();
  });

  test("has no placeholder once the day has notes", () => {
    renderColumn([NOTE]);

    expect(screen.getByText("Llamar al plomero")).toBeTruthy();
    expect(screen.queryByText(t.addNote)).toBeNull();
  });
});
