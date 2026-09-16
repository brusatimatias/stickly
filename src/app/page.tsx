import { addDays, format } from "date-fns";
import { auth } from "@/auth";
import { getNotesForWeek } from "@/lib/notes";
import {
  formatWeekParam,
  getAdjacentWeekStart,
  getWeekRange,
  parseWeekParam,
} from "@/lib/week";
import SignInScreen from "@/components/auth/SignInScreen";
import SignOutButton from "@/components/auth/SignOutButton";
import Board from "@/components/board/Board";
import type { NoteDTO } from "@/components/board/types";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return <SignInScreen />;
  }

  const { week } = await searchParams;
  const reference = parseWeekParam(week);
  const { start, end } = getWeekRange(reference);

  const notes = await getNotesForWeek(session.user.id, start, end);

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(start, index);
    return { key: format(date, "yyyy-MM-dd"), label: format(date, "EEE d") };
  });

  const notesByDay: Record<string, NoteDTO[]> = Object.fromEntries(
    days.map((day) => [day.key, []])
  );
  for (const note of notes) {
    if (!note.scheduledAt) continue;
    const key = format(note.scheduledAt, "yyyy-MM-dd");
    notesByDay[key]?.push({
      id: note.id,
      title: note.title,
      location: note.location,
      time: format(note.scheduledAt, "HH:mm"),
    });
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Sticly
        </h1>
        <SignOutButton />
      </header>
      <Board
        key={format(start, "yyyy-MM-dd")}
        days={days}
        notesByDay={notesByDay}
        weekLabel={`${format(start, "MMM d")} – ${format(addDays(start, 6), "MMM d, yyyy")}`}
        prevWeekParam={formatWeekParam(getAdjacentWeekStart(start, "prev"))}
        nextWeekParam={formatWeekParam(getAdjacentWeekStart(start, "next"))}
        currentWeekParam={format(start, "yyyy-MM-dd")}
      />
    </div>
  );
}
