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
import {
  HINT_CLASS,
  LABEL_CLASS,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
  StatusMessage,
  type Status,
} from "@/components/profile/ui";

function errorCode(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

/**
 * Turns notifications on or off for this device. Permission and subscription
 * are per browser, so this only ever talks about the device it runs on.
 */
export default function NotificationSettings({ vapidPublicKey }: { vapidPublicKey: string }) {
  const t = useTranslations("profile.notifications");
  const tErrors = useTranslations("errors");
  // null until the browser has been checked (it can't be known on the server).
  const [device, setDevice] = useState<PushDeviceState | null>(null);
  const [status, setStatus] = useState<Status>(null);
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
        const code = errorCode(error);
        if (code === "PUSH_SUBSCRIPTION_NOT_FOUND") {
          // The push service dropped it (or another account took this
          // browser): show the device as off so it can be turned on again.
          setDevice({ kind: "off" });
        }
        setStatus({
          type: "error",
          text: code && tErrors.has(code) ? tErrors(code) : tErrors("GENERIC"),
        });
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
    <section className="flex flex-col gap-2 pt-6 not-last:pb-6">
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
    </section>
  );
}
