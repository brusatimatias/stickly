import webpush from "web-push";
import { createTranslator } from "next-intl";
import { DEFAULT_LOCALE, isSupportedLocale } from "@/i18n/locales";
import { prisma } from "@/lib/prisma";
import en from "../../messages/en.json";
import es from "../../messages/es.json";

/**
 * Sending Web Push notifications. Kept out of "use server" files: background
 * senders (reminders) use it too, with no request or session.
 *
 * Needs the VAPID key pair (`npx web-push generate-vapid-keys`) and a contact
 * for the push services (`VAPID_SUBJECT`, a mailto: or https: URL). Without
 * them the profile hides the notifications section.
 */

export type PushPayload = {
  title: string;
  body: string;
  /** Opened (or focused) when the notification is tapped. */
  url: string;
  /** Notifications with the same tag replace each other on the device. */
  tag?: string;
};

// A push service that doesn't answer shouldn't hold up the other sends.
const SEND_TIMEOUT_MS = 10_000;

type StoredSubscription = { id: string; endpoint: string; p256dh: string; auth: string };

export function getVapidPublicKey(env: Record<string, string | undefined> = process.env): string | null {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = env;
  return VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT ? VAPID_PUBLIC_KEY : null;
}

/**
 * The VAPID contact as the push services want it, a mailto: or https: URL.
 * A bare email is the obvious thing to write in the env var, so it's accepted
 * too.
 */
export function getVapidSubject(subject: string): string {
  const trimmed = subject.trim();
  return /^[^:\s@]+@[^\s@]+$/.test(trimmed) ? `mailto:${trimmed}` : trimmed;
}

function getStatus(error: unknown): number | undefined {
  return (error as { statusCode?: number } | null)?.statusCode;
}

/**
 * Sends a notification to one device. Never throws: "gone" means the push
 * service no longer knows the subscription (notifications were turned off in
 * the browser, the app was uninstalled), and its row is deleted; "failed" is
 * logged.
 */
export async function sendPushNotification(
  subscription: StoredSubscription,
  payload: PushPayload,
  {
    ttlSeconds,
    urgency = "normal",
  }: {
    /** How long the push service keeps trying a device that's offline. */
    ttlSeconds: number;
    /** "high" wakes a sleeping phone right away (reminders); "normal" can wait a bit. */
    urgency?: "normal" | "high";
  }
): Promise<"sent" | "gone" | "failed"> {
  try {
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      JSON.stringify(payload),
      {
        TTL: ttlSeconds,
        urgency,
        timeout: SEND_TIMEOUT_MS,
        vapidDetails: {
          subject: getVapidSubject(process.env.VAPID_SUBJECT!),
          publicKey: process.env.VAPID_PUBLIC_KEY!,
          privateKey: process.env.VAPID_PRIVATE_KEY!,
        },
      }
    );
    return "sent";
  } catch (error) {
    const status = getStatus(error);
    if (status === 404 || status === 410) {
      await prisma.pushSubscription.deleteMany({ where: { id: subscription.id } }).catch((deleteError) => {
        console.error(`[push] couldn't delete gone subscription ${subscription.id}`, deleteError);
      });
      return "gone";
    }
    console.error(`[push] couldn't send to subscription ${subscription.id} (${status ?? "no status"})`, error);
    return "failed";
  }
}

const MESSAGES = { en, es };

/**
 * The `notifications` messages in a subscription's locale. Background sends
 * have no request to read the locale cookie from, so it's stored with the
 * subscription.
 */
export function getNotificationTranslator(locale: string) {
  const supported = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
  return createTranslator({ locale: supported, messages: MESSAGES[supported], namespace: "notifications" });
}
