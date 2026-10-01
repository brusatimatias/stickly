"use server";

import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { parsePushEndpoint, parsePushSubscription } from "@/lib/pushSubscription";
import { requireUserId } from "@/lib/session";
import { getNotificationTranslator, sendPushNotification } from "@/lib/webPush";

// A test that can't be delivered within a minute is no longer useful.
const TEST_TTL_SECONDS = 60;

/*
 * The device's notification state lives in the browser (its permission and
 * subscription), not in anything server rendered, so these don't revalidate.
 */

/**
 * Stores this device's push subscription for the current user. Also called
 * whenever the profile opens on a subscribed device, to refresh its locale
 * and move it to whoever is signed in there now.
 */
export async function savePushSubscription(input: unknown) {
  const userId = await requireUserId();
  const { endpoint, keys } = parsePushSubscription(input);
  const locale = await getLocale();

  const data = { userId, p256dh: keys.p256dh, auth: keys.auth, locale };
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, ...data },
    update: data,
  });
}

/** Turns notifications off for a device of the current user. */
export async function deletePushSubscription(endpoint: unknown) {
  const userId = await requireUserId();
  await prisma.pushSubscription.deleteMany({ where: { endpoint: parsePushEndpoint(endpoint), userId } });
}

/** Sends a test notification to one of the current user's devices. */
export async function sendTestNotification(endpoint: unknown) {
  const userId = await requireUserId();
  const subscription = await prisma.pushSubscription.findFirst({
    where: { endpoint: parsePushEndpoint(endpoint), userId },
  });
  if (!subscription) {
    throw new Error("PUSH_SUBSCRIPTION_NOT_FOUND");
  }

  const t = getNotificationTranslator(subscription.locale);
  const result = await sendPushNotification(
    subscription,
    { title: t("testTitle"), body: t("testBody"), url: "/profile", tag: "test" },
    { ttlSeconds: TEST_TTL_SECONDS, urgency: "high" }
  );
  if (result === "gone") {
    throw new Error("PUSH_SUBSCRIPTION_NOT_FOUND");
  }
  if (result === "failed") {
    throw new Error("PUSH_SEND_FAILED");
  }
}
