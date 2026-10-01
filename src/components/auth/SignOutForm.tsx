"use client";

import type { ReactNode } from "react";
import { deletePushSubscription } from "@/app/actions/push";
import { getExistingPushSubscription } from "@/components/profile/pushDevice";

/**
 * Turns this browser's notifications off before signing out, so whoever uses
 * it next doesn't get the previous user's reminders. Best-effort: signing out
 * must work even if that fails.
 */
async function forgetThisDevice() {
  try {
    const subscription = await getExistingPushSubscription();
    if (!subscription) return;
    await deletePushSubscription(subscription.endpoint).catch(() => {});
    await subscription.unsubscribe();
  } catch (error) {
    console.error("Couldn't turn this device's notifications off on sign out", error);
  }
}

export default function SignOutForm({
  signOut,
  children,
}: {
  signOut: () => Promise<void>;
  children: ReactNode;
}) {
  return (
    <form
      action={async () => {
        await forgetThisDevice();
        await signOut();
      }}
    >
      {children}
    </form>
  );
}
