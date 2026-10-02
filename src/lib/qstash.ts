import { Client, Receiver } from "@upstash/qstash";
import { getSiteUrl } from "@/lib/siteMetadata";

/**
 * Upstash QStash delivers each reminder to `/api/reminders/deliver` at its
 * time, so the database is only woken up when there's something to send
 * (Neon's free tier counts the hours it's awake). Locally, `QSTASH_DEV=true`
 * runs QStash's dev server instead, with no account; the SDK reads
 * QSTASH_TOKEN / QSTASH_*_SIGNING_KEY from the env otherwise.
 *
 * Kept out of "use server" files: it takes no session.
 */

const DELIVER_PATH = "/api/reminders/deliver";

// A failed delivery is retried a couple of times; past that, a reminder would
// be too late anyway (see MAX_REMINDER_DELAY_MS).
const DELIVERY_RETRIES = 2;

export function isQStashConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return (
    env.QSTASH_DEV === "true" ||
    Boolean(env.QSTASH_TOKEN && env.QSTASH_CURRENT_SIGNING_KEY && env.QSTASH_NEXT_SIGNING_KEY)
  );
}

/** Where QStash sends the reminders: the app's public URL (`SITE_URL`, else Vercel's production domain). */
export function getDeliverUrl(): string {
  return new URL(DELIVER_PATH, getSiteUrl()).href;
}

let client: Client | null = null;

export type QueuedReminder = { body: unknown; notBefore: Date; deduplicationId: string };

// QStash's limit per batch request.
const BATCH_SIZE = 100;

/**
 * Queues each reminder for delivery at its `notBefore`, in batches. QStash
 * ignores a message whose `deduplicationId` it has seen in the last 90 days,
 * so queueing the same reminder again (the daily cron, a re-save) is
 * harmless. The ids include the delivery instant, and a delivered message's
 * instant is in the past, which is never queued again, so this can't swallow
 * a reminder that's still due.
 */
export async function queueReminders(reminders: QueuedReminder[]): Promise<void> {
  client ??= new Client();
  for (let i = 0; i < reminders.length; i += BATCH_SIZE) {
    await client.batchJSON(
      reminders.slice(i, i + BATCH_SIZE).map(({ body, notBefore, deduplicationId }) => ({
        url: getDeliverUrl(),
        body,
        notBefore: Math.floor(notBefore.getTime() / 1000),
        deduplicationId,
        retries: DELIVERY_RETRIES,
      }))
    );
  }
}

let receiver: Receiver | null = null;

/** Whether a delivery really comes from QStash (its signature over the raw body). */
export async function isValidQStashSignature(signature: string | null, body: string): Promise<boolean> {
  if (!signature) return false;
  try {
    // Throws without signing keys: then nothing is valid.
    receiver ??= new Receiver();
    // Also checks it was signed for this endpoint, not replayed from another.
    return await receiver.verify({ signature, body, url: getDeliverUrl(), clockTolerance: 5 });
  } catch {
    return false;
  }
}
