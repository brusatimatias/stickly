import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PASSWORD_RESET_PARAM } from "@/lib/profile";
import { isRecentGoogleSignIn } from "@/lib/session";
import { isQStashConfigured } from "@/lib/qstash";
import { getVapidPublicKey } from "@/lib/webPush";
import SignOutButton from "@/components/auth/SignOutButton";
import ProfileForm from "@/components/profile/ProfileForm";
import ProfileShell from "@/components/profile/ProfileShell";

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

  const [user, { password: passwordParam }] = await Promise.all([
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
    searchParams,
  ]);
  const botNumber = process.env.WHATSAPP_DISPLAY_NUMBER;
  const vapidPublicKey = getVapidPublicKey();

  return (
    <ProfileShell signOut={<SignOutButton />}>
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
    </ProfileShell>
  );
}
