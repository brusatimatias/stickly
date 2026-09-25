---
name: ui-conventions
description: Visual, interaction and React conventions for Stickly's board UI — sticky-note card styling (hash-based color/rotation, folded corner, done/draft states, dark mode), @dnd-kit drag & drop, optimistic updates, keyboard shortcuts, responsive layout and next-intl strings. Use this whenever creating or modifying anything under src/components (cards, forms, day columns, week nav, draft panel, sign-in/profile screens), tweaking styling or dark mode, or debugging drag & drop or render loops on the board, even for small visual tweaks.
effort: low
---

# Stickly board UI conventions

The look is "sticky notes on a whiteboard". New UI should look like it belongs there. The existing components are the reference; copy from them instead of inventing new styles.

## Component map (`src/components/board/`)
- `Board.tsx`: top-level client component. Owns `DndContext`, the `DragOverlay`, `notesByDay` state, and focus-day mode.
- `DayColumn.tsx` (one day, a `SortableContext`), `DraftPanel.tsx` (the draft slot), `WeekNav.tsx`, `DayFocusNav.tsx`.
- Cards: `NoteCard.tsx` / `DraftCard.tsx`. Their in-place edit forms: `NoteForm.tsx` / `DraftForm.tsx`, which render in the same card shape and colors as the card they replace.
- `useNoteEditorKeyboard.ts`: shared keyboard handling (Shift+Enter submits, etc.). Any new editor form should use it instead of adding its own `onKeyDown` logic.
- `FoldedCorner.tsx`, `icons.tsx`, `ConfirmDialog.tsx`, `TimePicker.tsx`: reuse them before adding new ones.

## Note card styling
- **Color, rotation and overlap are derived from the note id**: `getNoteStyle(id)` in `src/lib/noteColor.ts` hashes the id and picks from `PALETTE`, `ROTATIONS` and `OVERLAPS`. The same note always looks the same, and there's no stored color. If a feature needs user-chosen colors, that's a schema change (see `new-entity-crud`), not a tweak here.
- **Palette entries are trios** (`bg`/`border`/`text`, Tailwind `-200`/`-300`/`-950`: yellow, pink, sky, green, purple). Always apply all three from the same entry.
- **Rotation**: a Tailwind class from `ROTATIONS`. **Overlap**: inline `marginTop`/`marginLeft` from `OVERLAPS`, not a class.
- **Card shell**: `relative flex h-44 w-44 sm:h-48 sm:w-48 overflow-hidden rounded-sm border p-2 text-sm` + `<FoldedCorner />`. Every card-like thing renders `FoldedCorner`: cards, forms, the drag overlay, and the sign-in stickers.
- **Shadows**: regular cards and `NoteForm` use `shadow-[2px_4px_6px_rgba(0,0,0,0.3)]` with a `dark:` variant at 0.6 and a heavier hover shadow. The draft uses `shadow-md`/`hover:shadow-lg`, and the drag overlay uses `shadow-lg`.
- **Hover**: `group`, `hover:-translate-y-1 hover:z-10`. Card controls (drag handle, done toggle, delete) sit at `opacity-30` and go to `group-hover:opacity-70`.
- **Done**: an overlay `bg-zinc-500/40 mix-blend-multiply dark:bg-zinc-400/30` over the palette color, plus `line-through` on the title only. Done notes also sort last in their day (`sortDoneLast`).
- **Draft**: fixed orange trio (`bg-orange-200 border-orange-300 text-orange-950`), fixed `-rotate-1`, no overlap offset. This is what distinguishes it from dated notes, so don't route it through `getNoteStyle`. The classes are duplicated in `DraftCard.tsx` and `DraftForm.tsx`; change both, or pull them into a shared constant.
- **Card colors are coupled**: the done overlay is `mix-blend-multiply` over the palette color, and the card also hardcodes status colors on top of it (the Calendar-synced icon `text-emerald-600 dark:text-emerald-400`, the error line `text-red-700`). Changing the palette changes how all of these read, so check them together.

## Dark mode
- It's **media-query based** (`prefers-color-scheme`, set up in `src/app/globals.css`). There's no class toggle and no `@custom-variant`, so `dark:` classes follow the OS setting.
- Tailwind v4: custom colors or tokens go in the `@theme inline` block of `globals.css` (there's no `tailwind.config`). Write full class names literally in source (`dark:bg-note-yellow`), never assembled from parts, or Tailwind won't generate them.
- Current gap: chrome, shadows, tooltips (`bg-zinc-900`/`dark:bg-zinc-100`) and the done overlay have `dark:` variants. `PALETTE` and the draft's orange do **not**, so they glare on the `#0a0a0a` background. To fill the gap, add `dark:` classes inside each palette entry's existing strings (the shape and the hash-based pick stay unchanged).
- Dark note backgrounds must be **opaque**. Notes overlap through the negative `OVERLAPS` margins, so a translucent background would show the note underneath.
- `SignInScreen.tsx` has its own separate `STICKER_PALETTE` (decorative stickers, no dark variants). Palette changes to `noteColor.ts` don't reach it.
- **Chrome** (nav buttons, pills, panels): zinc neutrals with `dark:` variants, `rounded-full` buttons, dashed `rounded-lg` borders for columns and panels, amber to highlight "today". Match `WeekNav`/`DayColumn`.

## Drag & drop (@dnd-kit)
Both of these caused infinite render loops before (commits `5dd3e9f`, `d55e0d1`):
- **Keep the custom `collisionDetectionStrategy` in `Board.tsx`** (`pointerWithin` → `rectIntersection` fallback, sticky `lastOverIdRef` right after a cross-container move). Don't switch back to `closestCenter`: when a note crosses into another day, the rects shift and closestCenter moves it back, over and over. If you add a new droppable container, reset the refs in `onDragEnd`/`onDragCancel` the way the existing code does.
- **Day columns lay out sortable items with CSS grid** (`[grid-template-columns:repeat(auto-fill,minmax(11rem,1fr))]`), not `flex-wrap`. With flex-wrap, reordering reflowed the items and the sort flipped back and forth.
- Drag feedback: the source card goes to `opacity: 0.5` (inline style) and `z-20`. `DragOverlay` in `Board.tsx` renders a simplified copy (palette + rotation + FoldedCorner + title).
- A drop calls `moveNote` / `scheduleDraftNote` inside `startTransition` and then `router.refresh()`.

## React state patterns
- **Syncing state from props**: this codebase adjusts state during render by comparing to a stored previous value (`lastServerNote` in `NoteCard`, `syncedWeekStart` in `Board`) instead of using a `useEffect` that sets state. Follow that pattern. An effect that sets state here adds an extra render and was part of the loops above.
- **Optimistic updates**: `NoteCard` keeps an `optimisticNote` and shows `optimisticNote ?? note`. The optimistic copy is dropped when the server `note` differs from `lastServerNote`, so any new editable field must be added to that comparison.
- Server actions are called from `useTransition` callbacks. Errors come back as string codes, which you translate with `useTranslations("errors")`.

## Responsive
- Board: `flex-col` below `lg:`, `lg:flex-row` (draft panel beside the week) above.
- Week grid: `grid-cols-1` → `sm:grid-cols-2` → `lg:grid-cols-7`. The whole week only fits side by side at `lg:`. On smaller screens, focus-day mode (`DayFocusNav`) is how users look at a single day.
- Check any new element at phone width. Cards are a fixed size, so containers have to handle them wrapping.

## i18n
- No hardcoded user-facing strings, including `aria-label`s and tooltips. Use `useTranslations("board")` (or the relevant namespace) and add every key to **both** `messages/en.json` and `messages/es.json`.
- Dates and day labels are localized (see commit `cef7e75`), so format them with the locale instead of hardcoding English names.

## Before finishing
- If you changed `noteColor.ts`, update `tests/lib/noteColor.test.ts`.
- Delegate a review to the `stickly-reviewer` subagent (required after board changes). The `Stop` hook already runs lint, type-check and tests.
