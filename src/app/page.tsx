import { addDays, format, parseISO } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { getLocale, getTranslations } from "next-intl/server";
import Image from "next/image";
import Link from "next/link";
import { auth } from "@/auth";
import { toStoredNoteDTO } from "@/lib/noteGroups";
import { getDraftNotes, getNotesForDays } from "@/lib/notes";
import { prisma } from "@/lib/prisma";
import { getTodayInZone } from "@/lib/timezone";
import { getUserTimeZone } from "@/lib/userTimeZone";
import {
  formatWeekParam,
  getAdjacentWeekStart,
  getWeekRange,
  parseWeekParam,
} from "@/lib/week";
import SignInScreen from "@/components/auth/SignInScreen";
import SignOutButton from "@/components/auth/SignOutButton";
import Board from "@/components/board/Board";
import ChatWidget from "@/components/chat/ChatWidget";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import PageHeader from "@/components/PageHeader";
import ThemeToggle from "@/components/ThemeToggle";
import TimeZoneSync from "@/components/TimeZoneSync";
import { FOCUS_RING } from "@/components/focusRing";
import { UserIcon } from "@/components/icons";

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
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, avatarUrl: true, imageUrl: true, timeZone: true },
  });
  // Notes are stored in UTC; the board shows them (and "today", and the week's
  // boundaries) in the user's zone, which the browser keeps up to date.
  const timeZone = await getUserTimeZone(user?.timeZone);
  const todayKey = getTodayInZone(timeZone, new Date());
  const { start, end } = getWeekRange(parseWeekParam(week, todayKey));

  const [notes, drafts, t, locale] = await Promise.all([
    getNotesForDays(
      session.user.id,
      format(start, "yyyy-MM-dd"),
      format(end, "yyyy-MM-dd"),
      timeZone
    ),
    getDraftNotes(session.user.id),
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
      weekday: format(date, "EEEEEE", { locale: dateFnsLocale }),
      dayNumber: format(date, "d"),
    };
  });

  const todayWeekParam = formatWeekParam(parseISO(todayKey));

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Stickly
        </h1>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/profile"
            className={`flex items-center gap-2 rounded-full text-sm font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100 ${FOCUS_RING}`}
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
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                <UserIcon className="h-4 w-4" />
              </span>
            )}
            {/* The name only fits next to the header controls from `sm:` up; below that it stays as the link's accessible name. */}
            {user?.name ? (
              <span className="sr-only sm:not-sr-only">{user.name}</span>
            ) : (
              <span className="sr-only">{t("yourProfile")}</span>
            )}
          </Link>
          <ThemeToggle />
          <LocaleSwitcher />
          <SignOutButton />
        </div>
      </PageHeader>
      <Board
        key={format(start, "yyyy-MM-dd")}
        days={days}
        notes={notes.map(toStoredNoteDTO)}
        draftNotes={drafts.map(toStoredNoteDTO)}
        timeZone={timeZone}
        weekLabel={`${format(start, "MMM d", { locale: dateFnsLocale })} – ${format(addDays(start, 6), "MMM d, yyyy", { locale: dateFnsLocale })}`}
        prevWeekParam={formatWeekParam(getAdjacentWeekStart(start, "prev"))}
        nextWeekParam={formatWeekParam(getAdjacentWeekStart(start, "next"))}
        currentWeekParam={format(start, "yyyy-MM-dd")}
        todayWeekParam={todayWeekParam}
        todayKey={todayKey}
      />
      <ChatWidget weekDays={days.map((day) => day.key)} />
      <TimeZoneSync storedTimeZone={user?.timeZone ?? null} />
    </div>
  );
}
