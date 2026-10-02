import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
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

import { createDraftNote, createNote, updateDraftNote } from "@/app/actions/notes";
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

const DRAFT: StoredNoteDTO = { ...NOTE, id: "draft-1", title: "Comprar pilas", kind: "ALL_DAY", startsAt: null };

function board(notes: StoredNoteDTO[], draftNotes: StoredNoteDTO[] = []) {
  return (
    <NextIntlClientProvider locale="es" messages={messages} timeZone="UTC">
      <Board
        days={DAYS}
        notes={notes}
        draftNotes={draftNotes}
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

function renderBoard(notes: StoredNoteDTO[], draftNotes: StoredNoteDTO[] = []) {
  return render(board(notes, draftNotes));
}

/** Writes `title` in the open form and saves it with Enter. */
async function writeAndSave(title: string) {
  const input = screen.getByLabelText(messages.board.titlePlaceholder);
  fireEvent.change(input, { target: { value: title } });
  await act(async () => {
    fireEvent.keyDown(input, { key: "Enter" });
  });
}

function endEntranceAnimation(element: HTMLElement) {
  // jsdom has no AnimationEvent, so React listens for the prefixed name.
  const end = new Event("webkitAnimationEnd", { bubbles: true });
  Object.assign(end, { animationName: "note-in" });
  fireEvent(element, end);
}

function cardOf(title: string) {
  return screen.getByText(title).closest("div.group") as HTMLElement;
}

beforeEach(() => {
  vi.mocked(createNote).mockReset();
  vi.mocked(createDraftNote).mockReset();
  vi.mocked(updateDraftNote).mockReset();
});

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

  test("animates a note that arrives after the first render, once", () => {
    const { rerender } = renderBoard([NOTE]);
    expect(cardOf("Renovar DNI").className).not.toContain("animate-note-in");

    const added: StoredNoteDTO = { ...NOTE, id: "note-2", title: "Llamar al plomero" };
    rerender(board([NOTE, added]));
    expect(cardOf("Llamar al plomero").className).toContain("animate-note-in");
    expect(cardOf("Renovar DNI").className).not.toContain("animate-note-in");

    endEntranceAnimation(cardOf("Llamar al plomero"));
    expect(cardOf("Llamar al plomero").className).not.toContain("animate-note-in");
  });

  describe("creating and editing before the server answers", () => {
    test("shows a new note right away and doesn't animate it again when the server has it", async () => {
      vi.mocked(createNote).mockReturnValue(new Promise(() => {}));
      const { rerender } = renderBoard([]);

      fireEvent.click(screen.getAllByLabelText(messages.board.addNote)[2]);
      await writeAndSave("Llamar al plomero");

      expect(cardOf("Llamar al plomero").className).toContain("animate-note-in");
      endEntranceAnimation(cardOf("Llamar al plomero"));

      const { id } = vi.mocked(createNote).mock.calls[0][0];
      rerender(board([{ ...NOTE, id, title: "Llamar al plomero" }]));
      expect(screen.getAllByText("Llamar al plomero")).toHaveLength(1);
      expect(cardOf("Llamar al plomero").className).not.toContain("animate-note-in");
    });

    test("keeps a new note on the board when another action's response arrives first", async () => {
      vi.mocked(createNote).mockReturnValue(new Promise(() => {}));
      const { rerender } = renderBoard([]);

      fireEvent.click(screen.getAllByLabelText(messages.board.addNote)[2]);
      await writeAndSave("Llamar al plomero");
      rerender(board([NOTE]));

      expect(screen.getByText("Renovar DNI")).toBeTruthy();
      expect(screen.getByText("Llamar al plomero")).toBeTruthy();
    });

    test("takes a new note off the board when creating it fails", async () => {
      vi.mocked(createNote).mockRejectedValue(new Error("INVALID_SCHEDULE"));
      // The error goes on to the route's error boundary, as before.
      const ignoreError = (event: ErrorEvent) => event.preventDefault();
      window.addEventListener("error", ignoreError);
      vi.spyOn(console, "error").mockImplementation(() => {});
      renderBoard([]);

      fireEvent.click(screen.getAllByLabelText(messages.board.addNote)[2]);
      await writeAndSave("Llamar al plomero");

      expect(screen.queryByText("Llamar al plomero")).toBeNull();
      window.removeEventListener("error", ignoreError);
      vi.mocked(console.error).mockRestore();
    });

    test("shows a new draft right away", async () => {
      vi.mocked(createDraftNote).mockReturnValue(new Promise(() => {}));
      renderBoard([]);

      fireEvent.click(screen.getByLabelText(messages.board.newDraftNote));
      await writeAndSave("Comprar pilas");

      expect(cardOf("Comprar pilas")).toBeTruthy();
      expect(screen.queryByLabelText(messages.board.titlePlaceholder)).toBeNull();
    });

    test("closes a draft's form with the edit shown, without waiting for the server", async () => {
      vi.mocked(updateDraftNote).mockReturnValue(new Promise(() => {}));
      renderBoard([], [DRAFT]);

      fireEvent.click(cardOf("Comprar pilas"));
      await writeAndSave("Comprar pilas AA");

      expect(screen.queryByLabelText(messages.board.titlePlaceholder)).toBeNull();
      expect(screen.getByText("Comprar pilas AA")).toBeTruthy();
      expect(updateDraftNote).toHaveBeenCalledWith(
        expect.objectContaining({ id: "draft-1", title: "Comprar pilas AA" })
      );
    });
  });
});
