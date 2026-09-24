import { addDays, format } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { getLocale, getTranslations } from "next-intl/server";
import Image from "next/image";
import Link from "next/link";
import { auth } from "@/auth";
import { getDraftNote, getNotesForWeek, groupNotesByDay, toDraftNoteDTO } from "@/lib/notes";
import { prisma } from "@/lib/prisma";
import {
  formatWeekParam,
  getAdjacentWeekStart,
  getWeekRange,
  parseWeekParam,
} from "@/lib/week";
import SignInScreen from "@/components/auth/SignInScreen";
import SignOutButton from "@/components/auth/SignOutButton";
import Board from "@/components/board/Board";
import LocaleSwitcher from "@/components/LocaleSwitcher";

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

  const [notes, draft, user, t, locale] = await Promise.all([
    getNotesForWeek(session.user.id, start, end),
    getDraftNote(session.user.id),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, avatarUrl: true, imageUrl: true },
    }),
    getTranslations("common"),
    getLocale(),
  ]);
  const avatarSrc = user?.avatarUrl ?? user?.imageUrl;
  const dateFnsLocale = locale === "es" ? es : enUS;

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(start, index);
    return {
      key: format(date, "yyyy-MM-dd"),
      label: format(date, "EEE d", { locale: dateFnsLocale }),
    };
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
          Stickly
        </h1>
        <div className="flex items-center gap-3">
          <Link
            href="/profile"
            className="flex items-center gap-2 text-sm font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
          >
            {avatarSrc ? (
              <Image
                src={avatarSrc}
                alt={user?.name ?? t("yourAvatar")}
                width={32}
                height={32}
                unoptimized={avatarSrc.startsWith("data:")}
                className="rounded-full"
              />
            ) : null}
            {user?.name ? <span>{user.name}</span> : null}
          </Link>
          <LocaleSwitcher />
          <SignOutButton />
        </div>
      </header>
      <Board
        key={format(start, "yyyy-MM-dd")}
        days={days}
        notesByDay={notesByDay}
        draftNote={draftNote}
        weekLabel={`${format(start, "MMM d", { locale: dateFnsLocale })} – ${format(addDays(start, 6), "MMM d, yyyy", { locale: dateFnsLocale })}`}
        prevWeekParam={formatWeekParam(getAdjacentWeekStart(start, "prev"))}
        nextWeekParam={formatWeekParam(getAdjacentWeekStart(start, "next"))}
        currentWeekParam={format(start, "yyyy-MM-dd")}
        todayWeekParam={todayWeekParam}
        todayKey={todayKey}
      />
    </div>
  );
}
