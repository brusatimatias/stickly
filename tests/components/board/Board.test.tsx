import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { startTransition } from "react";
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

import {
  createDraftNote,
  createNote,
  deleteNote,
  toggleNoteDone,
  updateDraftNote,
} from "@/app/actions/notes";
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
  vi.mocked(toggleNoteDone).mockReset();
  vi.mocked(deleteNote).mockReset();
});

/**
 * A server action that answers when the test says so. React keeps every
 * optimistic value until all pending actions settle, so each test's actions
 * are settled when it ends (one left hanging would hold up the next tests).
 */
const unsettled: (() => void)[] = [];
function deferred() {
  let settle!: { resolve: () => void; reject: (error: Error) => void };
  const promise = new Promise<void>((resolve, reject) => {
    settle = { resolve, reject };
  });
  unsettled.push(settle.resolve);
  return { promise, ...settle };
}

afterEach(async () => {
  await act(async () => unsettled.splice(0).forEach((resolve) => resolve()));
  cleanup();
});

describe("Board", () => {
  describe("scrolling to today", () => {
    function stubLayout(todayTop: number) {
      const scrollIntoView = vi.fn();
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
        this: HTMLElement
      ) {
        const top = this.dataset.day === "2026-09-30" ? todayTop : 0;
        return { top } as DOMRect;
      });
      // jsdom has no scrollIntoView, so it's defined here and removed after.
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
        value: scrollIntoView,
        configurable: true,
      });
      return scrollIntoView;
    }

    afterEach(() => {
      vi.restoreAllMocks();
      delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
      window.scrollY = 0;
    });

    test("scrolls to today when the days stack and it's below the fold", () => {
      const scrollIntoView = stubLayout(window.innerHeight * 2);

      renderBoard([]);

      expect(scrollIntoView).toHaveBeenCalledOnce();
      expect(scrollIntoView.mock.contexts[0]).toBe(document.querySelector('[data-day="2026-09-30"]'));
    });

    test("keeps the scroll a reload or back navigation restored", () => {
      const scrollIntoView = stubLayout(window.innerHeight * 2);
      window.scrollY = 300;

      renderBoard([]);

      expect(scrollIntoView).not.toHaveBeenCalled();
    });

    test("does nothing in a week without today", () => {
      const scrollIntoView = stubLayout(window.innerHeight * 2);

      render(
        <NextIntlClientProvider locale="es" messages={messages} timeZone="UTC">
          <Board
            days={DAYS}
            notes={[]}
            draftNotes={[]}
            timeZone="UTC"
            weekLabel="sep 28 – oct 4, 2026"
            prevWeekParam="2026-09-21"
            nextWeekParam="2026-10-05"
            currentWeekParam="2026-09-28"
            todayWeekParam="2026-10-05"
            todayKey="2026-10-07"
          />
        </NextIntlClientProvider>
      );

      expect(scrollIntoView).not.toHaveBeenCalled();
    });

    test("stays put when today is already in view", () => {
      const scrollIntoView = stubLayout(100);

      renderBoard([]);

      expect(scrollIntoView).not.toHaveBeenCalled();
    });
  });

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

  describe("showing changes before the server answers", () => {
    /**
     * Answers the action with the board re-rendered from `notes`, which Next
     * commits in the action's transition (one response, one commit).
     */
    async function answer(
      action: { resolve: () => void },
      rerender: (ui: React.ReactNode) => void,
      notes: StoredNoteDTO[],
      draftNotes: StoredNoteDTO[] = []
    ) {
      await act(async () => {
        startTransition(() => rerender(board(notes, draftNotes)));
        action.resolve();
      });
    }

    async function fail(action: { reject: (error: Error) => void }, code: string) {
      await act(async () => action.reject(new Error(code)));
      await act(async () => {});
    }

    test("shows a new note right away and doesn't animate it again when the server has it", async () => {
      const create = deferred();
      vi.mocked(createNote).mockReturnValue(create.promise);
      const { rerender } = renderBoard([]);

      fireEvent.click(screen.getAllByLabelText(messages.board.addNote)[2]);
      await writeAndSave("Llamar al plomero");
      expect(cardOf("Llamar al plomero").className).toContain("animate-note-in");
      endEntranceAnimation(cardOf("Llamar al plomero"));

      const { id } = vi.mocked(createNote).mock.calls[0][0];
      await answer(create, rerender, [{ ...NOTE, id, title: "Llamar al plomero" }]);

      expect(screen.getAllByText("Llamar al plomero")).toHaveLength(1);
      expect(cardOf("Llamar al plomero").className).not.toContain("animate-note-in");
    });

    test("keeps a new note on the board when another response arrives first", async () => {
      vi.mocked(createNote).mockImplementation(() => deferred().promise);
      const { rerender } = renderBoard([]);

      fireEvent.click(screen.getAllByLabelText(messages.board.addNote)[2]);
      await writeAndSave("Llamar al plomero");
      rerender(board([NOTE]));

      expect(screen.getByText("Renovar DNI")).toBeTruthy();
      expect(screen.getByText("Llamar al plomero")).toBeTruthy();
    });

    test("takes a new note off the board and says why when creating it fails", async () => {
      const create = deferred();
      vi.mocked(createNote).mockReturnValue(create.promise);
      renderBoard([]);

      fireEvent.click(screen.getAllByLabelText(messages.board.addNote)[2]);
      await writeAndSave("Llamar al plomero");
      await fail(create, "INVALID_SCHEDULE");

      expect(screen.queryByText("Llamar al plomero")).toBeNull();
      expect(screen.getByRole("alert").textContent).toContain(messages.errors.INVALID_SCHEDULE);
    });

    test("shows a new draft right away", async () => {
      vi.mocked(createDraftNote).mockImplementation(() => deferred().promise);
      renderBoard([]);

      fireEvent.click(screen.getByLabelText(messages.board.newDraftNote));
      await writeAndSave("Comprar pilas");

      expect(cardOf("Comprar pilas")).toBeTruthy();
      expect(screen.queryByLabelText(messages.board.titlePlaceholder)).toBeNull();
    });

    test("closes a draft's form with the edit shown, without waiting for the server", async () => {
      vi.mocked(updateDraftNote).mockImplementation(() => deferred().promise);
      renderBoard([], [DRAFT]);
      fireEvent.click(screen.getByRole("button", { name: messages.board.showDrafts }));

      fireEvent.click(cardOf("Comprar pilas"));
      await writeAndSave("Comprar pilas AA");

      expect(screen.queryByLabelText(messages.board.titlePlaceholder)).toBeNull();
      expect(screen.getByText("Comprar pilas AA")).toBeTruthy();
      expect(updateDraftNote).toHaveBeenCalledWith(
        expect.objectContaining({ id: "draft-1", title: "Comprar pilas AA" })
      );
    });

    test("puts an edit back when saving it fails", async () => {
      const update = deferred();
      vi.mocked(updateDraftNote).mockReturnValue(update.promise);
      renderBoard([], [DRAFT]);
      fireEvent.click(screen.getByRole("button", { name: messages.board.showDrafts }));

      fireEvent.click(cardOf("Comprar pilas"));
      await writeAndSave("Comprar pilas AA");
      await fail(update, "DRAFT_NOTE_NOT_FOUND");

      expect(screen.getByText("Comprar pilas")).toBeTruthy();
      expect(screen.getByRole("alert").textContent).toContain(messages.errors.DRAFT_NOTE_NOT_FOUND);
    });

    test("can toggle a note twice in a row before the server answers", async () => {
      vi.mocked(toggleNoteDone).mockImplementation(() => deferred().promise);
      renderBoard([NOTE]);

      fireEvent.click(screen.getByLabelText(messages.board.markAsDone));
      await act(async () => {});
      fireEvent.click(screen.getByLabelText(messages.board.markAsPending));
      await act(async () => {});

      expect(screen.getByLabelText(messages.board.markAsDone)).toBeTruthy();
      expect(vi.mocked(toggleNoteDone).mock.calls).toEqual([
        ["note-1", true],
        ["note-1", false],
      ]);
    });

    test("brings a deleted note back and says why when deleting it fails", async () => {
      const remove = deferred();
      vi.mocked(deleteNote).mockReturnValue(remove.promise);
      renderBoard([NOTE]);

      fireEvent.click(screen.getByLabelText(messages.board.deleteNote));
      const [confirm] = screen.getAllByRole("button", { name: messages.board.deleteNote }).slice(-1);
      await act(async () => fireEvent.click(confirm));
      expect(cardOf("Renovar DNI").classList.contains("hidden")).toBe(true);

      await fail(remove, "GOOGLE_RECONNECT_REQUIRED");

      expect(cardOf("Renovar DNI").classList.contains("hidden")).toBe(false);
      expect(screen.getByRole("alert").textContent).toContain(messages.errors.GOOGLE_RECONNECT_REQUIRED);
    });

    test("falls back to a generic message for an unknown error", async () => {
      const toggle = deferred();
      vi.mocked(toggleNoteDone).mockReturnValue(toggle.promise);
      renderBoard([NOTE]);

      fireEvent.click(screen.getByLabelText(messages.board.markAsDone));
      await fail(toggle, "Something exploded");

      expect(screen.getByLabelText(messages.board.markAsDone)).toBeTruthy();
      expect(screen.getByRole("alert").textContent).toContain(messages.errors.GENERIC);
      fireEvent.click(screen.getByLabelText(messages.board.dismissError));
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });
});
