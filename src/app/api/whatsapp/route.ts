import { after, type NextRequest } from "next/server";
import { handleInboundMessage } from "@/lib/whatsappInbound";
import { isValidWebhookSignature, parseWebhookMessages } from "@/lib/whatsappWebhook";

// Messages are handled after the response, within the function's duration;
// a model turn can take ~20 s, plus a retry with the fallback model.
export const maxDuration = 60;

/** Meta's one-time check when the webhook URL is configured. */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (
    verifyToken &&
    params.get("hub.mode") === "subscribe" &&
    params.get("hub.verify_token") === verifyToken
  ) {
    return new Response(params.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response(null, { status: 403 });
}

/**
 * Incoming WhatsApp messages (and delivery receipts, which are ignored).
 * Answers 200 right away and handles the messages afterwards: Meta retries
 * a webhook that's slow to answer, and the model can take a while.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (
    !isValidWebhookSignature(
      rawBody,
      request.headers.get("x-hub-signature-256"),
      process.env.WHATSAPP_APP_SECRET ?? ""
    )
  ) {
    return new Response(null, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response(null, { status: 400 });
  }

  const messages = parseWebhookMessages(payload);
  after(async () => {
    for (const message of messages) {
      try {
        await handleInboundMessage(message);
      } catch (error) {
        console.error("[whatsapp] failed to handle message", message.wamid, error);
      }
    }
  });
  return new Response(null, { status: 200 });
}
