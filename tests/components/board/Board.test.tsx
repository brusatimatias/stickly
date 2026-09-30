import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, test, vi } from "vitest";
import messages from "../../../messages/es.json";

vi.mock("@/app/actions/notes", () => ({
  createNote: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
  toggleNoteDone: vi.fn(),
  moveNote: vi.fn(),
  createDraftNote: vi.fn(),
  updateDraftNote: vi.fn(),
  moveDraftNote: vi.fn(),
  scheduleDraftNote: vi.fn(),
}));
vi.mock("@/app/actions/calendar", () => ({ addNoteToGoogleCalendar: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

import Board from "@/components/board/Board";
import type { StoredNoteDTO } from "@/components/board/types";

const DAYS = ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"].map(
  (key) => ({ key, label: key })
);

const NOTE: StoredNoteDTO = {
  id: "note-1",
  title: "Renovar DNI",
  location: null,
  description: null,
  isDone: false,
  googleEventId: null,
  kind: "TIMED",
  startsAt: "2026-09-30T14:00:00.000Z",
};

function renderBoard(notes: StoredNoteDTO[]) {
  render(
    <NextIntlClientProvider locale="es" messages={messages} timeZone="UTC">
      <Board
        days={DAYS}
        notes={notes}
        draftNotes={[]}
        timeZone="UTC"
        weekLabel="sep 28 – oct 4, 2026"
        prevWeekParam="2026-09-21"
        nextWeekParam="2026-10-05"
        currentWeekParam="2026-09-28"
        todayWeekParam="2026-09-28"
        todayKey="2026-09-30"
      />
    </NextIntlClientProvider>
  );
}

afterEach(cleanup);

describe("Board", () => {
  test("points at the + buttons and the assistant when the week is empty", () => {
    renderBoard([]);

    expect(screen.getByText(messages.board.emptyWeekHint)).toBeTruthy();
  });

  test("has no empty-week hint once a day has a note", () => {
    renderBoard([NOTE]);

    expect(screen.getByText("Renovar DNI")).toBeTruthy();
    expect(screen.queryByText(messages.board.emptyWeekHint)).toBeNull();
  });
});
