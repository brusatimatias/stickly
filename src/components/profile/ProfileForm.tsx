"use client";

import AvatarSection from "@/components/profile/AvatarSection";
import InstallApp from "@/components/profile/InstallApp";
import NameSection from "@/components/profile/NameSection";
import NotificationSettings from "@/components/profile/NotificationSettings";
import PasswordSection from "@/components/profile/PasswordSection";
import { CARD_CLASS } from "@/components/profile/ui";
import WhatsAppLink from "@/components/profile/WhatsAppLink";
import type { ReminderSettings } from "@/lib/reminderSettings";

export default function ProfileForm({
  name,
  email,
  avatarSrc,
  hasPassword,
  canResetWithGoogle,
  recentGoogleSignIn,
  openPasswordForm,
  whatsapp,
  notifications,
}: {
  name: string;
  email: string;
  avatarSrc: string | null;
  hasPassword: boolean;
  /** The user has Google linked, so a forgotten password can be reset by signing in again. */
  canResetWithGoogle: boolean;
  /** The session just signed in with Google, which stands in for the current password. */
  recentGoogleSignIn: boolean;
  /** Back from confirming with Google: start with the password form open. */
  openPasswordForm: boolean;
  /** Null when the WhatsApp chat isn't configured, which hides the section. */
  whatsapp: { linkedNumber: string | null; botNumber: string } | null;
  /** Null when push isn't configured (no VAPID keys). */
  notifications: { vapidPublicKey: string; reminders: ReminderSettings | null } | null;
}) {
  const hasSideCards = Boolean(notifications || whatsapp);

  return (
    // Account on the left; notifications and WhatsApp in their own cards on
    // the right on wide screens, below it on phones.
    <div
      className={`grid w-full max-w-sm items-start gap-6 ${hasSideCards ? "lg:max-w-4xl lg:grid-cols-2" : ""}`}
    >
      <div className={CARD_CLASS}>
        <AvatarSection avatarSrc={avatarSrc} name={name} />
        <NameSection name={name} />
        <PasswordSection
          email={email}
          hasPassword={hasPassword}
          canResetWithGoogle={canResetWithGoogle}
          recentGoogleSignIn={recentGoogleSignIn}
          openPasswordForm={openPasswordForm}
        />
      </div>

      <div className="flex flex-col gap-6">
        {/* Hidden while empty: the install section only shows on phones. */}
        <div className={`${CARD_CLASS} empty:hidden`}>
          <InstallApp />
          {notifications && <NotificationSettings {...notifications} />}
        </div>
        {whatsapp && (
          <div className={CARD_CLASS}>
            <WhatsAppLink {...whatsapp} />
          </div>
        )}
      </div>
    </div>
  );
}
