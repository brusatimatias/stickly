"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  getFirstCollision,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useTranslations } from "next-intl";
import {
  startTransition,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useOptimistic,
  useRef,
  useState,
} from "react";
import { moveDraftNote, moveNote, scheduleDraftNote } from "@/app/actions/notes";
import {
  BoardActionsProvider,
  DRAFT_CONTAINER,
  type BoardAction,
} from "@/components/board/BoardActionsContext";
import DayColumn from "@/components/board/DayColumn";
import DayFocusNav from "@/components/board/DayFocusNav";
import DraftPanel from "@/components/board/DraftPanel";
import FoldedCorner from "@/components/board/FoldedCorner";
import { TimeZoneProvider } from "@/components/board/TimeZoneContext";
import WeekNav from "@/components/board/WeekNav";
import type { BoardDay, NoteDTO, StoredNoteDTO } from "@/components/board/types";
import { useErrorMessage } from "@/components/errorMessage";
import { FOCUS_RING } from "@/components/focusRing";
import { getNoteStyle } from "@/lib/noteColor";
import { groupNotesByDay, toDraftNoteDTO } from "@/lib/noteGroups";
import { sortDoneLast } from "@/lib/ordering";
import { toScheduleInput, toStoredSchedule } from "@/lib/schedule";

type NotesByDay = Record<string, NoteDTO[]>;

/** A note being created, shown before the server data has it. */
type PendingNote = { container: string; note: NoteDTO };

function findContainer(id: string, notesByDay: NotesByDay): string | undefined {
  if (id in notesByDay) return id;
  return Object.keys(notesByDay).find((day) =>
    notesByDay[day].some((note) => note.id === id)
  );
}

export default function Board({
  days,
  notes,
  draftNotes,
  timeZone,
  weekLabel,
  prevWeekParam,
  nextWeekParam,
  currentWeekParam,
  todayWeekParam,
  todayKey,
}: {
  days: BoardDay[];
  /** The week's notes as stored (UTC); grouped here into local days of `timeZone`. */
  notes: StoredNoteDTO[];
  /** The user's drafts, in their panel order. */
  draftNotes: StoredNoteDTO[];
  timeZone: string;
  weekLabel: string;
  prevWeekParam: string;
  nextWeekParam: string;
  currentWeekParam: string;
  todayWeekParam: string;
  todayKey: string;
}) {
  const t = useTranslations("board");
  // From the server data, not `notesByDay`, so the hint doesn't come and go
  // (shifting the layout) while a draft is being dragged onto the week.
  const isWeekEmpty = notes.length === 0;
  function buildNotesByDay(): NotesByDay {
    return {
      ...groupNotesByDay(
        notes,
        days.map((day) => day.key),
        timeZone
      ),
      [DRAFT_CONTAINER]: draftNotes.map(toDraftNoteDTO),
    };
  }

  const [notesByDay, setNotesByDay] = useState<NotesByDay>(buildNotesByDay);
  // Notes being created, shown until the action's response commits (the
  // server data then has them) or dropped if the action fails.
  const [pendingNotes, addPendingNote] = useOptimistic<PendingNote[], PendingNote>(
    [],
    (current, added) => [...current, added]
  );
  // Ids created on this board, set in the action's transition so they commit
  // with the server data that brings them: they animated in while pending,
  // so they don't animate again then.
  const [createdIds, setCreatedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [syncedNotes, setSyncedNotes] = useState(notes);
  const [syncedDraftNotes, setSyncedDraftNotes] = useState(draftNotes);
  const [syncedTimeZone, setSyncedTimeZone] = useState(timeZone);
  // Notes that weren't in the previous server data (just created, here or
  // from the chat) animate in. A note moved to another day or a scheduled
  // draft keeps its id, so it doesn't. The set is cleared when the entrance
  // animation ends (so a later remount, e.g. entering focus-day mode, doesn't
  // replay it), not on every refresh, which could cut it short.
  const [newNoteIds, setNewNoteIds] = useState<ReadonlySet<string>>(() => new Set());
  if (notes !== syncedNotes || draftNotes !== syncedDraftNotes || timeZone !== syncedTimeZone) {
    const previousIds = new Set([...syncedNotes, ...syncedDraftNotes].map((note) => note.id));
    const serverIds = new Set([...notes, ...draftNotes].map((note) => note.id));
    const addedIds = [...serverIds].filter((id) => !previousIds.has(id) && !createdIds.has(id));
    if (addedIds.length > 0) setNewNoteIds(new Set(addedIds));
    if ([...createdIds].some((id) => serverIds.has(id))) {
      setCreatedIds(new Set([...createdIds].filter((id) => !serverIds.has(id))));
    }
    setSyncedNotes(notes);
    setSyncedDraftNotes(draftNotes);
    setSyncedTimeZone(timeZone);
    setNotesByDay(buildNotesByDay());
  }

  // What the board renders: the server data (rearranged while dragging) plus
  // the notes being created, which animate in.
  function notesIn(container: string): NoteDTO[] {
    const list = notesByDay[container] ?? [];
    const pending = pendingNotes
      .filter((entry) => entry.container === container && !list.some(({ id }) => id === entry.note.id))
      .map(({ note }) => note);
    return pending.length > 0 ? sortDoneLast([...list, ...pending]) : list;
  }
  const animatedIds =
    pendingNotes.length > 0
      ? new Set([...newNoteIds, ...pendingNotes.map(({ note }) => note.id)])
      : newNoteIds;

  const errorMessage = useErrorMessage();
  // What a failed action threw, shown above the board until dismissed or the next action.
  const [actionError, setActionError] = useState<unknown>(null);
  const boardActions = useMemo(
    () => ({
      run({ optimistic, action, onError }: BoardAction) {
        setActionError(null);
        startTransition(async () => {
          optimistic?.();
          try {
            await action();
          } catch (error) {
            // Whatever `optimistic` set with useOptimistic is undone when the
            // transition ends; the board stays and says what went wrong.
            setActionError(error);
            onError?.();
          }
        });
      },
      addPendingNote(container: string, note: NoteDTO) {
        addPendingNote({ container, note });
        setCreatedIds((current) => new Set(current).add(note.id));
      },
    }),
    [addPendingNote]
  );
  const [activeNote, setActiveNote] = useState<NoteDTO | null>(null);
  const originContainerRef = useRef<string | null>(null);
  const lastOverIdRef = useRef<string | null>(null);
  const recentlyMovedToNewContainerRef = useRef(false);
  const [focusedDay, setFocusedDay] = useState<string | null>(null);
  const [syncedWeekStart, setSyncedWeekStart] = useState(days[0]?.key);
  if (days[0]?.key !== syncedWeekStart) {
    setSyncedWeekStart(days[0]?.key);
    setFocusedDay(null);
  }
  const focusedDayInfo = days.find((day) => day.key === focusedDay) ?? null;
  // dnd-kit derives its aria-describedby ids from a module-level counter that
  // differs between the server and client renders (hydration mismatch); a
  // stable id from useId makes them deterministic.
  const dndContextId = useId();
  const sensors = useSensors(
    // Mouse and touch instead of PointerSensor, which would also start a drag
    // on touch right away. On touch, a drag needs a short press on the handle,
    // so a swipe over it still scrolls the page.
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      recentlyMovedToNewContainerRef.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [notesByDay]);

  // Moving a note between containers during dragOver can make plain
  // closestCenter flip back to the origin container's item right after the
  // move (because the DOM/rects just shifted), which reverses the move and
  // re-triggers the same flip — an infinite render loop. Prefer pointer-based
  // collisions and, right after a cross-container move, stick to the last
  // known target instead of letting rects re-decide it that same frame.
  const collisionDetectionStrategy: CollisionDetection = useCallback(
    (args) => {
      const pointerIntersections = pointerWithin(args);
      const intersections =
        pointerIntersections.length > 0 ? pointerIntersections : rectIntersection(args);
      let overId = getFirstCollision(intersections, "id") as string | null;

      if (overId != null) {
        lastOverIdRef.current = overId;
        return [{ id: overId }];
      }

      if (recentlyMovedToNewContainerRef.current) {
        overId = lastOverIdRef.current;
      }

      return overId != null ? [{ id: overId }] : [];
    },
    []
  );

  function handleDragStart(event: DragStartEvent) {
    // A card dragged into another day remounts there; don't replay its entrance.
    setNewNoteIds(new Set());
    const container = findContainer(event.active.id as string, notesByDay) ?? null;
    originContainerRef.current = container;
    setActiveNote(
      container
        ? (notesByDay[container].find((note) => note.id === event.active.id) ?? null)
        : null
    );
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeContainer = findContainer(active.id as string, notesByDay);
    const overContainer =
      findContainer(over.id as string, notesByDay) ?? (over.id as string);

    if (!activeContainer || !overContainer) {
      return;
    }

    if (activeContainer === overContainer) {
      setNotesByDay((prev) => {
        const items = prev[activeContainer];
        const activeIndex = items.findIndex((note) => note.id === active.id);
        const overIndex = items.findIndex((note) => note.id === over.id);
        if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) {
          return prev;
        }

        if (items[activeIndex].isDone !== items[overIndex].isDone) {
          return prev;
        }

        return { ...prev, [activeContainer]: arrayMove(items, activeIndex, overIndex) };
      });
      return;
    }

    // Only drafts may ever occupy the draft container, so a regular scheduled
    // note can never be dropped back into it.
    if (overContainer === DRAFT_CONTAINER && originContainerRef.current !== DRAFT_CONTAINER) {
      return;
    }

    recentlyMovedToNewContainerRef.current = true;
    setNotesByDay((prev) => {
      const activeItems = prev[activeContainer];
      const overItems = prev[overContainer];
      const activeIndex = activeItems.findIndex((note) => note.id === active.id);
      const overIndex = overItems.findIndex((note) => note.id === over.id);
      if (activeIndex === -1) return prev;

      const movingNote = activeItems[activeIndex];
      const rawIndex = overIndex >= 0 ? overIndex : overItems.length;

      const pendingCount = overItems.filter((note) => !note.isDone).length;
      const newIndex = movingNote.isDone
        ? Math.max(rawIndex, pendingCount)
        : Math.min(rawIndex, pendingCount);

      return {
        ...prev,
        [activeContainer]: activeItems.filter((note) => note.id !== active.id),
        [overContainer]: [
          ...overItems.slice(0, newIndex),
          movingNote,
          ...overItems.slice(newIndex),
        ],
      };
    });
  }

  // A failed move puts the notes back where the server has them.
  function run(boardAction: BoardAction) {
    boardActions.run({ ...boardAction, onError: () => setNotesByDay(buildNotesByDay()) });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const originContainer = originContainerRef.current;
    originContainerRef.current = null;
    lastOverIdRef.current = null;
    setActiveNote(null);
    if (!over) return;

    const destinationContainer =
      findContainer(active.id as string, notesByDay) ?? (over.id as string);
    const items = notesByDay[destinationContainer] ?? [];
    const index = items.findIndex((note) => note.id === active.id);
    if (index === -1) return;

    if (destinationContainer === DRAFT_CONTAINER) {
      // Reordered among the drafts (a draft dragged over a day and back ends
      // up here too).
      run({ action: () => moveDraftNote({ noteId: active.id as string, index }) });
      return;
    }

    // Same local time on the new day (or just the new day), stored as UTC.
    const schedule = toScheduleInput(
      toStoredSchedule(destinationContainer, items[index].time, timeZone)
    );

    run({
      action: () =>
        originContainer === DRAFT_CONTAINER
          ? scheduleDraftNote({ noteId: active.id as string, day: destinationContainer, index })
          : moveNote({ noteId: active.id as string, day: destinationContainer, index, schedule }),
    });
  }

  return (
    <TimeZoneProvider value={timeZone}>
      <BoardActionsProvider value={boardActions}>
        <div
          className="flex flex-1 flex-col"
          onAnimationEnd={(event) => {
            if (event.animationName === "note-in") setNewNoteIds(new Set());
          }}
        >
          <WeekNav
            weekLabel={weekLabel}
            prevWeekParam={prevWeekParam}
            nextWeekParam={nextWeekParam}
            currentWeekParam={currentWeekParam}
            todayWeekParam={todayWeekParam}
          />
          {actionError != null && (
            <div
              role="alert"
              className="mx-4 mt-3 flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
            >
              <span>{errorMessage(actionError)}</span>
              <button
                type="button"
                aria-label={t("dismissError")}
                onClick={() => setActionError(null)}
                className={`shrink-0 rounded-full px-1 opacity-70 hover:opacity-100 pointer-coarse:size-10 ${FOCUS_RING}`}
              >
                ✕
              </button>
            </div>
          )}
          <DndContext
            id={dndContextId}
            sensors={sensors}
            collisionDetection={collisionDetectionStrategy}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={() => {
              lastOverIdRef.current = null;
              setActiveNote(null);
            }}
          >
            {/* Bottom padding so the chat launcher never covers the last notes. */}
            <div className="flex flex-col gap-3 p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:flex-row">
              <DraftPanel notes={notesIn(DRAFT_CONTAINER)} newNoteIds={animatedIds} />
              {focusedDayInfo ? (
                <div className="animate-week-in min-w-0 flex-1">
                  <DayFocusNav
                    days={days}
                    focusedDay={focusedDayInfo.key}
                    todayKey={todayKey}
                    onSelect={setFocusedDay}
                    onExit={() => setFocusedDay(null)}
                  />
                  <DayColumn
                    day={focusedDayInfo}
                    notes={notesIn(focusedDayInfo.key)}
                    newNoteIds={animatedIds}
                    todayKey={todayKey}
                    isFocused
                  />
                </div>
              ) : (
                <div className="animate-week-in grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
                  {isWeekEmpty && (
                    <p className="col-span-full rounded-lg border border-dashed border-zinc-200 px-4 py-2.5 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                      {t("emptyWeekHint")}
                    </p>
                  )}
                  {days.map((day, index) => (
                    <div
                      key={day.key}
                      className={
                        index > 0
                          ? "shadow-[inset_1px_0_0_rgba(0,0,0,0.1)] dark:shadow-[inset_1px_0_0_rgba(255,255,255,0.08)]"
                          : ""
                      }
                    >
                      <DayColumn
                        day={day}
                        notes={notesIn(day.key)}
                        newNoteIds={animatedIds}
                        todayKey={todayKey}
                        onToggleFocus={() => setFocusedDay(day.key)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DragOverlay>
              {activeNote &&
                (() => {
                  const style = getNoteStyle(activeNote.id);
                  return (
                    <div
                      className={`relative flex h-44 w-44 flex-col justify-center overflow-hidden rounded-sm border p-2 text-sm shadow-lg sm:h-48 sm:w-48 ${style.rotation} ${style.bg} ${style.border} ${style.text}`}
                    >
                      <FoldedCorner />
                      <p className="line-clamp-3 font-semibold">{activeNote.title}</p>
                    </div>
                  );
                })()}
            </DragOverlay>
          </DndContext>
        </div>
      </BoardActionsProvider>
    </TimeZoneProvider>
  );
}
