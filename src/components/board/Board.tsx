"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { moveNote, scheduleDraftNote } from "@/app/actions/notes";
import DayColumn from "@/components/board/DayColumn";
import DraftPanel from "@/components/board/DraftPanel";
import FoldedCorner from "@/components/board/FoldedCorner";
import WeekNav from "@/components/board/WeekNav";
import type { BoardDay, NoteDTO } from "@/components/board/types";
import { getNoteStyle } from "@/lib/noteColor";

const DRAFT_CONTAINER = "draft";

type NotesByDay = Record<string, NoteDTO[]>;

function findContainer(id: string, notesByDay: NotesByDay): string | undefined {
  if (id in notesByDay) return id;
  return Object.keys(notesByDay).find((day) =>
    notesByDay[day].some((note) => note.id === id)
  );
}

export default function Board({
  days,
  notesByDay: initialNotesByDay,
  draftNote,
  weekLabel,
  prevWeekParam,
  nextWeekParam,
  currentWeekParam,
}: {
  days: BoardDay[];
  notesByDay: NotesByDay;
  draftNote: NoteDTO | null;
  weekLabel: string;
  prevWeekParam: string;
  nextWeekParam: string;
  currentWeekParam: string;
}) {
  const router = useRouter();
  function buildNotesByDay(): NotesByDay {
    return {
      ...initialNotesByDay,
      [DRAFT_CONTAINER]: draftNote ? [draftNote] : [],
    };
  }

  const [notesByDay, setNotesByDay] = useState<NotesByDay>(buildNotesByDay);
  const [syncedNotesByDay, setSyncedNotesByDay] = useState(initialNotesByDay);
  const [syncedDraftNote, setSyncedDraftNote] = useState(draftNote);
  if (initialNotesByDay !== syncedNotesByDay || draftNote !== syncedDraftNote) {
    setSyncedNotesByDay(initialNotesByDay);
    setSyncedDraftNote(draftNote);
    setNotesByDay(buildNotesByDay());
  }
  const [, startTransition] = useTransition();
  const [activeNote, setActiveNote] = useState<NoteDTO | null>(null);
  const originContainerRef = useRef<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function handleDragStart(event: DragStartEvent) {
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

    if (!activeContainer || !overContainer || activeContainer === overContainer) {
      return;
    }

    // Only the draft note itself may ever occupy the draft container, so a
    // regular scheduled note can never be dropped back into it.
    if (overContainer === DRAFT_CONTAINER && originContainerRef.current !== DRAFT_CONTAINER) {
      return;
    }

    setNotesByDay((prev) => {
      const activeItems = prev[activeContainer];
      const overItems = prev[overContainer];
      const activeIndex = activeItems.findIndex((note) => note.id === active.id);
      const overIndex = overItems.findIndex((note) => note.id === over.id);
      if (activeIndex === -1) return prev;

      const movingNote = activeItems[activeIndex];
      const newIndex = overIndex >= 0 ? overIndex : overItems.length;

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

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const originContainer = originContainerRef.current;
    originContainerRef.current = null;
    setActiveNote(null);
    if (!over) return;

    const destinationContainer =
      findContainer(active.id as string, notesByDay) ?? (over.id as string);
    const items = notesByDay[destinationContainer] ?? [];
    const index = items.findIndex((note) => note.id === active.id);
    if (index === -1 || destinationContainer === DRAFT_CONTAINER) return;

    startTransition(async () => {
      if (originContainer === DRAFT_CONTAINER) {
        await scheduleDraftNote({
          noteId: active.id as string,
          day: destinationContainer,
          index,
        });
      } else {
        await moveNote({ noteId: active.id as string, day: destinationContainer, index });
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-1 flex-col">
      <WeekNav
        weekLabel={weekLabel}
        prevWeekParam={prevWeekParam}
        nextWeekParam={nextWeekParam}
        currentWeekParam={currentWeekParam}
      />
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveNote(null)}
      >
        <div className="flex flex-col gap-3 p-4 lg:flex-row">
          <DraftPanel note={notesByDay[DRAFT_CONTAINER][0] ?? null} />
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
            {days.map((day) => (
              <DayColumn key={day.key} day={day} notes={notesByDay[day.key] ?? []} />
            ))}
          </div>
        </div>
        <DragOverlay>
          {activeNote &&
            (() => {
              const style = getNoteStyle(activeNote.id);
              return (
                <div
                  className={`relative flex h-36 w-36 flex-col justify-center overflow-hidden rounded-sm border p-2 text-sm shadow-lg sm:h-40 sm:w-40 ${style.rotation} ${style.bg} ${style.border} ${style.text}`}
                >
                  <FoldedCorner />
                  <p className="line-clamp-3 font-semibold">{activeNote.title}</p>
                </div>
              );
            })()}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
