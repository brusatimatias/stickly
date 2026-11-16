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
import { MAX_DRAFT_NOTES } from "@/lib/noteInput";

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

function panel(notes: NoteDTO[], newNoteIds: ReadonlySet<string> = new Set()) {
  return (
    <NextIntlClientProvider locale="es" messages={messages}>
      <DndContext>
        <DraftPanel notes={notes} newNoteIds={newNoteIds} isDragging={false} />
      </DndContext>
    </NextIntlClientProvider>
  );
}

function renderPanel(notes: NoteDTO[], newNoteIds: ReadonlySet<string> = new Set()) {
  return render(panel(notes, newNoteIds));
}

/** jsdom has no layout: the chips row ends at `rowRight` and each chip is 60px wide. */
function mockChipLayout(rowRight: number) {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement
  ) {
    const index = this.title.match(/^Draft (\d+)$/)?.[1];
    return { right: index === undefined ? rowRight : 60 * (Number(index) + 1) } as DOMRect;
  });
}

const COUNT = /^\+\d+$/;

const NEW_DRAFT = messages.board.newDraftNote;
const SHOW_DRAFTS = messages.board.showDrafts;
const HIDE_DRAFTS = messages.board.hideDrafts;
const card = (title: string) => screen.getByText(title).closest("div.group");

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("DraftPanel", () => {
  test("lists every draft and offers a new one below the limit", () => {
    renderPanel(drafts(3));

    expect(screen.getByText("Draft 0")).toBeTruthy();
    expect(screen.getByText("Draft 2")).toBeTruthy();
    expect(screen.getByRole("button", { name: NEW_DRAFT })).toBeTruthy();
  });

  test("starts collapsed, showing only the drafts' titles", () => {
    renderPanel(drafts(2));

    expect(screen.getByText("Draft 0")).toBeTruthy();
    expect(card("Draft 0")).toBeNull();
    expect(screen.getByRole("button", { name: SHOW_DRAFTS }).getAttribute("aria-expanded")).toBe("false");
  });

  test("shows the cards when expanded, from the toggle or a title", () => {
    renderPanel(drafts(2));

    fireEvent.click(screen.getByText("Draft 1"));
    expect(card("Draft 1")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: HIDE_DRAFTS }));
    expect(card("Draft 1")).toBeNull();
  });

  test("expands to write a new draft", () => {
    renderPanel(drafts(1));

    fireEvent.click(screen.getByRole("button", { name: NEW_DRAFT }));

    expect(card("Draft 0")).toBeTruthy();
    expect(screen.getByLabelText(messages.board.titlePlaceholder)).toBeTruthy();
  });

  test("hides the new draft button at the draft limit", () => {
    renderPanel(drafts(MAX_DRAFT_NOTES));

    expect(screen.getByText(`Draft ${MAX_DRAFT_NOTES - 1}`)).toBeTruthy();
    expect(screen.queryByRole("button", { name: NEW_DRAFT })).toBeNull();
  });

  test("hides the new draft button while one is being written", () => {
    renderPanel(drafts(0));

    fireEvent.click(screen.getByRole("button", { name: NEW_DRAFT }));

    expect(screen.getByLabelText(messages.board.titlePlaceholder)).toBeTruthy();
    expect(screen.queryByRole("button", { name: NEW_DRAFT })).toBeNull();
  });

  test("animates only the drafts that just appeared", () => {
    renderPanel(drafts(2), new Set(["draft-1"]));
    fireEvent.click(screen.getByRole("button", { name: SHOW_DRAFTS }));

    expect(card("Draft 1")!.className).toContain("animate-note-in");
    expect(card("Draft 0")!.className).not.toContain("animate-note-in");
  });

  test("keeps a cancelled new draft mounted until its exit animation ends", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
    renderPanel(drafts(0));
    fireEvent.click(screen.getByRole("button", { name: NEW_DRAFT }));
    const input = screen.getByLabelText(messages.board.titlePlaceholder);

    fireEvent.keyDown(input, { key: "Escape" });

    const wrapper = input.closest("[inert]") as HTMLElement;
    expect(wrapper.className).toContain("animate-form-out");
    // jsdom has no AnimationEvent, so React listens for the prefixed name.
    fireEvent(wrapper, new Event("webkitAnimationEnd", { bubbles: true }));
    expect(screen.queryByLabelText(messages.board.titlePlaceholder)).toBeNull();
    expect(screen.getByRole("button", { name: NEW_DRAFT })).toBeTruthy();
  });

  test("explains drafts and their limit while the panel is empty", () => {
    renderPanel(drafts(0));

    expect(screen.getByText(messages.board.emptyDraftsHint.replace("{count}", String(MAX_DRAFT_NOTES)))).toBeTruthy();
  });

  test("hides the hint once there is a draft or one is being written", () => {
    renderPanel(drafts(1));
    expect(screen.queryByText(/Notas sin fecha/)).toBeNull();

    cleanup();
    renderPanel(drafts(0));
    fireEvent.click(screen.getByRole("button", { name: NEW_DRAFT }));
    expect(screen.queryByText(/Notas sin fecha/)).toBeNull();
  });

  test("counts the titles that don't fit the collapsed row", () => {
    mockChipLayout(100);
    renderPanel(drafts(3));

    expect(screen.getByText("+2")).toBeTruthy();
    expect(screen.getByTitle("Draft 0").style.visibility).toBe("");
    expect(screen.getByTitle("Draft 1").style.visibility).toBe("hidden");
    expect(screen.getByTitle("Draft 2").style.visibility).toBe("hidden");
  });

  test("shows no count when every title fits", () => {
    mockChipLayout(500);
    renderPanel(drafts(3));

    expect(screen.queryByText(COUNT)).toBeNull();
    expect(screen.getByTitle("Draft 2").style.visibility).toBe("");
  });

  test("expands the tray from the count, and hides it while expanded", () => {
    mockChipLayout(100);
    renderPanel(drafts(3));

    fireEvent.click(screen.getByText("+2"));

    expect(screen.getByRole("button", { name: HIDE_DRAFTS })).toBeTruthy();
    expect(screen.queryByText(COUNT)).toBeNull();
  });

  test("updates the count when the drafts change", () => {
    mockChipLayout(100);
    const { rerender } = renderPanel(drafts(3));

    rerender(panel(drafts(2)));
    expect(screen.getByText("+1")).toBeTruthy();

    rerender(panel(drafts(0)));
    expect(screen.queryByText(COUNT)).toBeNull();
  });
});
