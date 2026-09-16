"use client";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { moveNote } from "@/app/actions/notes";
import DayColumn from "@/components/board/DayColumn";
import WeekNav from "@/components/board/WeekNav";
import type { BoardDay, NoteDTO } from "@/components/board/types";

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
  weekLabel,
  prevWeekParam,
  nextWeekParam,
  currentWeekParam,
}: {
  days: BoardDay[];
  notesByDay: NotesByDay;
  weekLabel: string;
  prevWeekParam: string;
  nextWeekParam: string;
  currentWeekParam: string;
}) {
  const router = useRouter();
  const [notesByDay, setNotesByDay] = useState(initialNotesByDay);
  const [, startTransition] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeContainer = findContainer(active.id as string, notesByDay);
    const overContainer =
      findContainer(over.id as string, notesByDay) ?? (over.id as string);

    if (!activeContainer || !overContainer || activeContainer === overContainer) {
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
    if (!over) return;

    const container = findContainer(active.id as string, notesByDay) ?? (over.id as string);
    const items = notesByDay[container] ?? [];
    const index = items.findIndex((note) => note.id === active.id);
    if (index === -1) return;

    startTransition(async () => {
      await moveNote({ noteId: active.id as string, day: container, index });
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
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid flex-1 grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-7">
          {days.map((day) => (
            <DayColumn key={day.key} day={day} notes={notesByDay[day.key] ?? []} />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
