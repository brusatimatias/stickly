import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Whether `signatureHeader` (Meta's `X-Hub-Signature-256`, "sha256=<hex>") is
 * the HMAC of the raw request body with the app secret, i.e. the request
 * really comes from Meta. Must get the body exactly as received: parsing and
 * re-serializing the JSON changes it.
 */
export function isValidWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): boolean {
  const received = signatureHeader?.match(/^sha256=([0-9a-f]{64})$/i)?.[1];
  if (!received || !appSecret) {
    return false;
  }
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest();
  return timingSafeEqual(Buffer.from(received, "hex"), expected);
}

export type InboundMessage = {
  /** Meta's message id, unique per message (used for idempotency). */
  wamid: string;
  /** Sender's number, E.164 digits without "+". */
  from: string;
  /** The text of a text message; null for any other type (audio, image, sticker…). */
  text: string | null;
};

type WebhookMessage = { id?: unknown; from?: unknown; type?: unknown; text?: { body?: unknown } };

/**
 * The incoming messages in a webhook payload. The payload is untrusted in
 * shape even when signed, so anything unexpected is skipped. Delivery and
 * read receipts (`statuses`) carry no messages and yield nothing.
 */
export function parseWebhookMessages(payload: unknown): InboundMessage[] {
  const entries = (payload as { entry?: unknown })?.entry;
  if (!Array.isArray(entries)) {
    return [];
  }

  const messages: InboundMessage[] = [];
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown })?.changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const value = (change as { field?: unknown; value?: { messages?: unknown } }) ?? {};
      if (value.field !== "messages" || !Array.isArray(value.value?.messages)) continue;
      for (const raw of value.value.messages as WebhookMessage[]) {
        if (typeof raw?.id !== "string" || typeof raw.from !== "string") continue;
        const text = raw.type === "text" && typeof raw.text?.body === "string" ? raw.text.body : null;
        messages.push({ wamid: raw.id, from: raw.from, text });
      }
    }
  }
  return messages;
}

/**
 * The number to send a reply to. Meta reports Argentine and Mexican mobile
 * numbers with their mobile prefix (549…, 521…) but only delivers to them
 * without it (54…, 52…), so replying to `from` as is fails.
 */
export function toReplyNumber(from: string): string {
  if (/^549\d{10}$/.test(from)) return `54${from.slice(3)}`;
  if (/^521\d{10}$/.test(from)) return `52${from.slice(3)}`;
  return from;
}
