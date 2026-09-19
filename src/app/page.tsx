import { addDays, format } from "date-fns";
import Image from "next/image";
import { auth } from "@/auth";
import { getDraftNote, getNotesForWeek, groupNotesByDay, toDraftNoteDTO } from "@/lib/notes";
import {
  formatWeekParam,
  getAdjacentWeekStart,
  getWeekRange,
  parseWeekParam,
} from "@/lib/week";
import SignInScreen from "@/components/auth/SignInScreen";
import SignOutButton from "@/components/auth/SignOutButton";
import Board from "@/components/board/Board";

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

  const [notes, draft] = await Promise.all([
    getNotesForWeek(session.user.id, start, end),
    getDraftNote(session.user.id),
  ]);

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(start, index);
    return { key: format(date, "yyyy-MM-dd"), label: format(date, "EEE d") };
  });

  const notesByDay = groupNotesByDay(
    notes,
    days.map((day) => day.key)
  );
  const draftNote = toDraftNoteDTO(draft);
  const now = new Date();
  const todayKey = format(now, "yyyy-MM-dd");
  const todayWeekParam = formatWeekParam(now);

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          stickly
        </h1>
        <div className="flex items-center gap-3">
          {session.user.image ? (
            <Image
              src={session.user.image}
              alt={session.user.name ?? "Your avatar"}
              width={32}
              height={32}
              className="rounded-full"
            />
          ) : null}
          <SignOutButton />
        </div>
      </header>
      <Board
        key={format(start, "yyyy-MM-dd")}
        days={days}
        notesByDay={notesByDay}
        draftNote={draftNote}
        weekLabel={`${format(start, "MMM d")} – ${format(addDays(start, 6), "MMM d, yyyy")}`}
        prevWeekParam={formatWeekParam(getAdjacentWeekStart(start, "prev"))}
        nextWeekParam={formatWeekParam(getAdjacentWeekStart(start, "next"))}
        currentWeekParam={format(start, "yyyy-MM-dd")}
        todayWeekParam={todayWeekParam}
        todayKey={todayKey}
      />
    </div>
  );
}
