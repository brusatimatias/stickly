import { toReplyNumber } from "@/lib/whatsappWebhook";

// Meta keeps each Graph API version for about two years.
const GRAPH_API_VERSION = "v23.0";

/**
 * Sends a text message through the WhatsApp Cloud API. Only valid as a reply
 * within 24 hours of the user's last message (the webhook only ever replies).
 * Best-effort: failures are logged, never thrown, since there's no one to
 * report them to.
 */
export async function sendWhatsAppText(to: string, body: string): Promise<void> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    console.error("[whatsapp] WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID is not set");
    return;
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: toReplyNumber(to),
          type: "text",
          text: { body, preview_url: false },
        }),
      }
    );
    if (!response.ok) {
      console.error("[whatsapp] send failed", response.status, await response.text());
    }
  } catch (error) {
    console.error("[whatsapp] send failed", error);
  }
}
