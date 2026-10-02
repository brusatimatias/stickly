"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import {
  deletePushSubscription,
  savePushSubscription,
  sendTestNotification,
} from "@/app/actions/push";
import {
  enablePush,
  getPushDeviceState,
  type PushDeviceState,
} from "@/components/profile/pushDevice";
import ReminderPreferences from "@/components/profile/ReminderPreferences";
import type { ReminderSettings } from "@/lib/reminderSettings";
import {
  HINT_CLASS,
  LABEL_CLASS,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
  StatusMessage,
  useAutoClearStatus,
  type Status,
  SECTION_CLASS,
} from "@/components/profile/ui";
import { errorCode, useErrorMessage } from "@/components/errorMessage";


/**
 * Turns notifications on or off for this device (permission and subscription
 * are per browser, so this only talks about the device it runs on), and below
 * it what the user is notified about, which applies to all their devices.
 */
export default function NotificationSettings({
  vapidPublicKey,
  reminders,
}: {
  vapidPublicKey: string;
  /** Null when reminders can't be sent (QStash isn't configured). */
  reminders: ReminderSettings | null;
}) {
  const t = useTranslations("profile.notifications");
  const errorMessage = useErrorMessage();
  // null until the browser has been checked (it can't be known on the server).
  const [device, setDevice] = useState<PushDeviceState | null>(null);
  const [status, setStatus] = useState<Status>(null);
  useAutoClearStatus(status, setStatus);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    getPushDeviceState()
      .then((state) => {
        if (cancelled) return;
        setDevice(state);
        // Refresh the stored locale, and the owner if another account
        // subscribed this browser before. Nothing to tell the user if it fails.
        if (state.kind === "on") {
          savePushSubscription(state.subscription.toJSON()).catch((error) => {
            console.error("Couldn't refresh this device's push subscription", error);
          });
        }
      })
      .catch(() => {
        if (!cancelled) setDevice({ kind: "unsupported" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function run(action: () => Promise<void>) {
    setStatus(null);
    startTransition(async () => {
      try {
        await action();
      } catch (error) {
        if (errorCode(error) === "PUSH_SUBSCRIPTION_NOT_FOUND") {
          // The push service dropped it (or another account took this
          // browser): show the device as off so it can be turned on again.
          setDevice({ kind: "off" });
        }
        setStatus({ type: "error", text: errorMessage(error) });
      }
    });
  }

  function enable() {
    run(async () => {
      const state = await enablePush(vapidPublicKey);
      if (state.kind === "on") {
        try {
          await savePushSubscription(state.subscription.toJSON());
        } catch (error) {
          // Don't leave the browser subscribed to something the server
          // doesn't know: it would show as on and never get anything.
          await state.subscription.unsubscribe().catch(() => {});
          throw error;
        }
        setStatus({ type: "success", text: t("enabled") });
      }
      setDevice(state);
    });
  }

  function disable() {
    if (device?.kind !== "on") return;
    const { subscription } = device;
    run(async () => {
      await subscription.unsubscribe();
      setDevice({ kind: "off" });
      await deletePushSubscription(subscription.endpoint);
      setStatus({ type: "success", text: t("disabled") });
    });
  }

  function sendTest() {
    if (device?.kind !== "on") return;
    const { endpoint } = device.subscription;
    run(async () => {
      await sendTestNotification(endpoint);
      setStatus({ type: "success", text: t("testSent") });
    });
  }

  return (
    <section className={SECTION_CLASS}>
      <h2 className={LABEL_CLASS}>{t("title")}</h2>
      {device === null ? (
        <p className={HINT_CLASS}>{t("checking")}</p>
      ) : device.kind === "on" ? (
        <>
          <p className={HINT_CLASS}>{t("onHint")}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={sendTest} disabled={isPending} className={PRIMARY_BUTTON}>
              {t("sendTest")}
            </button>
            <button type="button" onClick={disable} disabled={isPending} className={SECONDARY_BUTTON}>
              {t("disable")}
            </button>
          </div>
        </>
      ) : device.kind === "off" ? (
        <>
          <p className={HINT_CLASS}>{t("offHint")}</p>
          <button
            type="button"
            onClick={enable}
            disabled={isPending}
            className={`self-start ${PRIMARY_BUTTON}`}
          >
            {t("enable")}
          </button>
        </>
      ) : (
        <p className={HINT_CLASS}>{t(`${device.kind}Hint`)}</p>
      )}
      <StatusMessage status={status} />
      {reminders && <ReminderPreferences initial={reminders} />}
    </section>
  );
}
