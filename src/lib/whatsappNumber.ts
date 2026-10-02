// Kept apart from whatsappLink.ts (node:crypto) because the profile's client
// component uses these.

/** Only the digits of a phone number, as Meta's `from` and wa.me links use them. */
function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** A stored number (E.164 digits) for display: "+5491122334455". */
export function formatWhatsAppNumber(digits: string): string {
  return `+${phoneDigits(digits)}`;
}

/** A wa.me link that opens a chat with `phone`, with `text` already typed. */
export function whatsAppChatUrl(phone: string, text: string): string {
  return `https://wa.me/${phoneDigits(phone)}?text=${encodeURIComponent(text)}`;
}
