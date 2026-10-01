import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PASSWORD_RESET_PARAM } from "@/lib/profile";
import { isRecentGoogleSignIn } from "@/lib/session";
import { isQStashConfigured } from "@/lib/qstash";
import { getVapidPublicKey } from "@/lib/webPush";
import ProfileForm from "@/components/profile/ProfileForm";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import ThemeToggle from "@/components/ThemeToggle";
import { ChevronLeftIcon } from "@/components/board/icons";
import { FOCUS_RING } from "@/components/focusRing";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("profileTitle") };
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ password?: string | string[] }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  const [user, t, { password: passwordParam }] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: {
        name: true,
        email: true,
        avatarUrl: true,
        imageUrl: true,
        password: true,
        googleId: true,
        whatsappNumber: true,
        reminderMinutesBefore: true,
        digestEnabled: true,
        digestTime: true,
      },
    }),
    getTranslations("profile"),
    searchParams,
  ]);
  const botNumber = process.env.WHATSAPP_DISPLAY_NUMBER;
  const vapidPublicKey = getVapidPublicKey();

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <Link
          href="/"
          className={`flex items-center gap-1 rounded-full py-1.5 pr-3 pl-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50 ${FOCUS_RING}`}
        >
          <ChevronLeftIcon className="h-4 w-4" />
          {t("backToBoard")}
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LocaleSwitcher />
        </div>
      </header>
      <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10 dark:bg-black">
        <ProfileForm
          name={user.name ?? ""}
          email={user.email}
          avatarSrc={user.avatarUrl ?? user.imageUrl}
          hasPassword={Boolean(user.password)}
          // googleId, not the stored tokens: those are cleared when Google
          // revokes them, which is when signing in again is most needed.
          canResetWithGoogle={Boolean(user.googleId)}
          recentGoogleSignIn={isRecentGoogleSignIn(session)}
          openPasswordForm={passwordParam === PASSWORD_RESET_PARAM}
          whatsapp={botNumber ? { linkedNumber: user.whatsappNumber, botNumber } : null}
          notifications={
            vapidPublicKey
              ? {
                  vapidPublicKey,
                  reminders: isQStashConfigured()
                    ? {
                        reminderMinutesBefore: user.reminderMinutesBefore,
                        digestEnabled: user.digestEnabled,
                        digestTime: user.digestTime,
                      }
                    : null,
                }
              : null
          }
        />
      </div>
    </div>
  );
}
