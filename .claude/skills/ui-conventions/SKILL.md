---
name: ui-conventions
description: Visual, interaction and React conventions for Stickly's board UI — sticky-note card styling (hash-based color/rotation, folded corner, done/draft states, dark mode), @dnd-kit drag & drop, optimistic updates, keyboard shortcuts, responsive layout and next-intl strings. Use this whenever creating or modifying anything under src/components (cards, forms, day columns, week nav, draft panel, sign-in/profile screens), tweaking styling or dark mode, or debugging drag & drop or render loops on the board, even for small visual tweaks.
effort: low
---

# Stickly board UI conventions

The look is "sticky notes on a whiteboard". New UI should look like it belongs there. The existing components are the reference; copy from them instead of inventing new styles.

## Component map (`src/components/board/`)
- `Board.tsx`: top-level client component. Owns `DndContext`, the `DragOverlay`, `notesByDay` state, and focus-day mode.
- `DayColumn.tsx` (one day, a `SortableContext`), `DraftPanel.tsx` (the drafts, up to `MAX_DRAFT_NOTES`), `WeekNav.tsx`, `DayFocusNav.tsx`.
- Cards: `NoteCard.tsx` / `DraftCard.tsx`. Their in-place edit forms: `NoteForm.tsx` / `DraftForm.tsx`, which render in the same card shape and colors as the card they replace.
- `useNoteEditor.ts`: what the edit forms share (fields, id, focus, Enter/outside click saves, Escape cancels, Shift+Enter adds a line break). Any new editor form should use it instead of its own `onKeyDown` or outside-click logic.
- `FoldedCorner.tsx`, `ConfirmDialog.tsx`, `TimePicker.tsx`: reuse them before adding new ones. Icons for the whole app live in `src/components/icons.tsx`, each a path inside the shared `Icon` outline.
- Outside the board, `src/components/chat/ChatWidget.tsx` is the assistant: a floating button plus a panel over a dimmed backdrop (clicking it, the ✕ or Escape closes it). Assistant replies render as small yellow sticky notes. It's mounted in `page.tsx` outside `<Board>` (which is keyed by week) so the conversation survives week navigation.

## Note card styling
- **Color, rotation and overlap are derived from the note id**: `getNoteStyle(id)` in `src/lib/noteColor.ts` hashes the id and picks from `PALETTE`, `ROTATIONS` and `OVERLAPS`. The same note always looks the same, and there's no stored color. If a feature needs user-chosen colors, that's a schema change (see `new-entity-crud`), not a tweak here.
- **Palette entries are trios** (`bg`/`border`/`text`, Tailwind `-200`/`-300`/`-950`: yellow, pink, sky, green, purple). Always apply all three from the same entry.
- **Rotation**: a Tailwind class from `ROTATIONS`. **Overlap**: inline `marginTop`/`marginLeft` from `OVERLAPS`, not a class.
- **Card shell**: `relative flex aspect-square w-full max-w-44 sm:max-w-48 overflow-hidden rounded-sm border p-2 text-sm` + `<FoldedCorner />`. Cards are fluid: they fill their grid track up to 11/12rem, so seven columns fit on a 14" laptop. `NoteCard` is an `@container` and shrinks what doesn't fit a narrow card with `@max-[9rem]:` (Calendar icon, a 13px title clamped to 2 lines, 11px time and location; `NoteForm` is an `@container` too and matches the title size; container queries measure the content box, inside the border and padding), and `NoteForm` keeps a `min-h-40` so its fields fit; the drag overlay is `size-full` (dnd-kit sizes it like the dragged card). Every card-like thing renders `FoldedCorner`: cards, forms, the drag overlay, and the sign-in stickers.
- **Shadows**: regular cards and `NoteForm` use `shadow-[2px_4px_6px_rgba(0,0,0,0.3)]` with a `dark:` variant at 0.6 and a heavier hover shadow. The draft uses `shadow-md`/`hover:shadow-lg`, and the drag overlay uses `shadow-lg`.
- **Hover**: `group`, `transition-[top] hover:-top-1 hover:z-10` (the cards are already `relative`). Card controls (drag handle, done toggle, delete) sit at `opacity-30` and go to `group-hover:opacity-70`; on touch screens (no hover) they stay at `pointer-coarse:opacity-70`. Hover-only tooltips also show on keyboard focus (`group-has-[:focus-visible]/…`), and the state they describe must be visible without them (icons, line-through).
- **Keep card text sharp**: cards are rotated, so anything that gives the text its own compositing layer makes it render blurry. Lift cards on hover with `top`, not a `transform` (`translate`), and dim editable fields with the text color (`text-current/80`), not `opacity` (a focused, dimmed textarea blurred while typing).
- **Done**: an overlay `bg-zinc-500/40 mix-blend-multiply dark:bg-zinc-400/30` over the palette color, plus `line-through` on the title only. Done notes also sort last in their day (`sortDoneLast`).
- **Draft**: fixed orange trio (`bg-orange-200 border-orange-300 text-orange-950`), fixed `-rotate-1`, and no hash-based overlap. This is what distinguishes it from dated notes, so don't route it through `getNoteStyle`. The classes live in `DRAFT_COLOR` (`src/lib/noteColor.ts`), shared by `DraftCard.tsx` and `DraftForm.tsx`.
- **Card colors are coupled**: the done overlay is `mix-blend-multiply` over the palette color, and the card also hardcodes status colors on top of it (the Calendar-synced icon `text-emerald-600 dark:text-emerald-400`, the error line `text-red-700`). Changing the palette changes how all of these read, so check them together.

## Dark mode
- **Theme selection**: `ThemeToggle.tsx` stores `light`/`dark` in the `THEME` cookie (`actions/theme.ts`, helpers in `src/lib/theme.ts`), and `layout.tsx` renders it as a class on `<html>`. The `@custom-variant dark` in `globals.css` matches `.dark`. With no cookie, it falls back to `prefers-color-scheme` unless `.light` is set. Keep using plain `dark:` classes and never read the theme in JS to pick styles; the CSS variant already handles all three states. New theme-dependent CSS variables need both the `:root.dark` rule and the `:root:not(.light)` media-query rule.
- Tailwind v4: custom colors or tokens go in the `@theme inline` block of `globals.css` (there's no `tailwind.config`). Write full class names literally in source (`dark:bg-note-yellow`), never assembled from parts, or Tailwind won't generate them.
- **Notes keep their pastel colors in dark mode, on purpose.** Chrome, shadows, tooltips (`bg-zinc-900`/`dark:bg-zinc-100`) and the done overlay have `dark:` variants, but `PALETTE`, `DRAFT_COLOR`, the chat's assistant notes and the sign-in stickers don't: dark variants were tried (`-800` backgrounds) and rejected, so don't add them. Colors drawn on a card (error line, folded corner) should therefore stay readable on the pastel background in both themes.
- `SignInScreen.tsx` has its own separate `STICKER_PALETTE` (decorative stickers, pastel in both themes). Palette changes to `noteColor.ts` don't reach it.
- **Chrome** (nav buttons, pills, panels): zinc neutrals with `dark:` variants, `rounded-full` buttons, dashed `rounded-lg` borders for columns and panels, amber to highlight "today". Match `WeekNav`/`DayColumn`.

## Drag & drop (@dnd-kit)
Both of these caused infinite render loops before (commits `5dd3e9f`, `d55e0d1`):
- **Keep the custom `collisionDetectionStrategy` in `Board.tsx`** (`pointerWithin` → `rectIntersection` fallback, sticky `lastOverIdRef` right after a cross-container move). Don't switch back to `closestCenter`: when a note crosses into another day, the rects shift and closestCenter moves it back, over and over. If you add a new droppable container, reset the refs in `onDragEnd`/`onDragCancel` the way the existing code does.
- **Day columns lay out sortable items with CSS grid** (`[grid-template-columns:repeat(auto-fill,minmax(min(11rem,100%),1fr))]`; the `min()` lets a narrow column have one track narrower than a card's max), not `flex-wrap`. With flex-wrap, reordering reflowed the items and the sort flipped back and forth.
- **Sensors**: `MouseSensor` (`distance: 8`) + `TouchSensor` (`delay: 250, tolerance: 8`) + `KeyboardSensor`. Not `PointerSensor`: it also handles touch and would start a drag immediately, so a swipe couldn't scroll. Mouse and keyboard drag from the handle (`touch-none`); a touch drags from anywhere on the card after the press delay (`delay: 250, tolerance: 8`), so a swipe still scrolls: `splitDragListeners` (`touchDrag.ts`) gives the card only `onTouchStart` and the handle the rest, and `TOUCH_DRAG_CARD` stops a long press from selecting text or opening the iOS callout (dnd-kit already blocks the context menu and the click after a drag). `handleDragStart` vibrates on a touch drag (Android).
- **The draft tray keeps its height during a drag** (`isDragging` from `Board`): it sits above the week, so shrinking it as a draft leaves would shift every droppable under the pointer. Anything new above the week must not change height mid-drag either.
- Drag feedback: the source card goes to `opacity: 0.5` (inline style) and `z-20`. `DragOverlay` in `Board.tsx` renders a simplified copy (palette + rotation + FoldedCorner + title).
- A drop calls `moveNote` / `moveDraftNote` / `scheduleDraftNote` inside `startTransition`; the action's response already carries the re-rendered board (no `router.refresh()`, see below).
- **Keep `id={useId()}` on `DndContext`.** Without it dnd-kit numbers its `aria-describedby` ids from a module-level counter that differs between server and client, which causes a hydration mismatch warning and leaves the attribute pointing at a missing element.

## React state patterns
- **Syncing state from props**: this codebase adjusts state during render by comparing to a stored previous value (`syncedNotes` and `syncedWeekStart` in `Board`) instead of using a `useEffect` that sets state. Follow that pattern. An effect that sets state here adds an extra render and was part of the loops above.
- **Board mutations go through `useBoardActions().run({ optimistic, action, onError? })`** (`BoardActionsContext.tsx`, provided by `Board`), never a direct `startTransition` + action call:
  - `optimistic` runs inside the action's transition and sets `useOptimistic` state, so the change shows on the current frame, lasts until the action's response (with the re-rendered board) commits, and is undone by React if the action throws. Don't mirror server props into `useState` for this (the old `lastServerNote` pattern).
  - A thrown error code shows as a dismissible `role="alert"` notice above the board (translated from `errors`, `GENERIC` otherwise); the board is never replaced by `error.tsx` for an expected failure. `onError` undoes plain state, e.g. a drag's preview.
  - Cards: `useOptimistic(note)` for edits and toggles, `useOptimistic(false)` for a deletion (the card gets `hidden`). The forms close at once and pass the saved note to the card's `showSaved` (edits) or `addPendingNote(container, note)` (new notes and drafts, with the client-generated id); `toShownNote` sanitizes it like the server does.
  - `Board` renders `notesIn(container)`: its `notesByDay` plus the pending notes. Ids created here are kept in `createdIds` (set in the transition, so it commits with the data) so they don't animate in twice.
  - Calendar sync is the exception: it waits on Google, so it keeps its spinner and its inline error on the card.
  - Tests: React holds every optimistic value until *all* pending actions settle, so mocked actions must settle by the end of each test (`deferred()` in `tests/components/board/Board.test.tsx`), and a re-render with the response's data goes in `startTransition`, as Next commits it.
- Don't follow a Server Action with `router.refresh()` when it calls `revalidatePath` (every board action) or sets a cookie (`setTheme`, `setLocale`): the action already returns the re-rendered page in the same response, and the refresh is a second full round trip (measured: 2 requests → 1).
- Deleting a note or draft hides the card while the transition is pending (`isDeleting` → `hidden`), so it disappears right away instead of after the round trip.
- Server actions are called from `useTransition` callbacks. Errors come back as string codes, which you translate with `useTranslations("errors")`.

## Motion and focus
- Keyframes live in `globals.css` as `.animate-*` classes, and **every one** is listed in the `prefers-reduced-motion` block there.
- Cards and forms animate `translate`/`scale`/`opacity`, never `transform`: dnd-kit writes an inline `transform` on sortable cards (an animation on it would override the drag), and the tilt is the separate `rotate` property.
- Exit animations keep the element mounted (and `inert`) until `animationend`; check `animatesExit()` (`src/components/motion.ts`) first, since with reduced motion (or in jsdom) `animationend` never fires. `useFormTransition` does this for the new-note/new-draft forms.
- New notes animate in because `Board` marks ids that weren't in the previous server data (`newNoteIds`); a moved note keeps its id, so drag & drop never animates.
- Keyboard focus: append `FOCUS_RING` (`src/components/focusRing.ts`) to any new button or link.
- Touch targets: small icon buttons grow to 40px with `pointer-coarse:` (e.g. `pointer-coarse:size-10`), without changing the desktop look.

## Responsive
- Board: always `flex-col`. The drafts are a tray above the week (`DraftPanel`), collapsed by default to one row of title chips; expanding it shows the cards, the only way to drag a draft.
- Week grid: `grid-cols-1` → `sm:grid-cols-2` → `lg:grid-cols-7`. The whole week only fits side by side at `lg:`. On smaller screens, focus-day mode (`DayFocusNav`) is how users look at a single day.
- **On-screen keyboard**: iOS Safari doesn't resize the layout viewport for the keyboard (and ignores `interactive-widget`), so a `fixed` element anchored to the bottom or sized with `dvh` ends up under it. Anything fixed with a text field (the chat) must follow the visual viewport (`useVisualViewportBox`, which the chat uses to go full screen on phones). iOS's zoom on focusing fields under 16px is stopped by `maximumScale: 1` in `generateViewport` (iOS only, by user agent), so fields don't need to be 16px.
- Check any new element at phone width and at a 14" laptop (~1280px, the narrowest seven-column layout).

## i18n
- No hardcoded user-facing strings, including `aria-label`s and tooltips. Use `useTranslations("board")` (or the relevant namespace) and add every key to **both** `messages/en.json` and `messages/es.json`.
- Dates and day labels are localized (see commit `cef7e75`), so format them with the locale instead of hardcoding English names.

## Before finishing
- If you changed `noteColor.ts`, update `tests/lib/noteColor.test.ts`.
- Component tests live in `tests/components/<folder>/` (mirroring `src/components/`), rendered inside `NextIntlClientProvider` with `messages/es.json` and with server actions and `next/navigation` mocked; see `tests/components/chat/ChatWidget.test.tsx`.
- Delegate a review to the `stickly-reviewer` subagent (required after board changes). The `Stop` hook already runs lint, type-check and tests.
