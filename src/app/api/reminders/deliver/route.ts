import type { NextRequest } from "next/server";
import { isValidQStashSignature } from "@/lib/qstash";
import { deliverReminder, parseReminderMessage } from "@/lib/reminders";

/**
 * QStash delivers each queued reminder here at its time (see
 * src/lib/reminders.ts). A non-2xx answer makes QStash retry, so only
 * unexpected errors return one; a reminder that no longer applies is a 200.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!(await isValidQStashSignature(request.headers.get("upstash-signature"), rawBody))) {
    return new Response(null, { status: 401 });
  }

  let message;
  try {
    message = parseReminderMessage(JSON.parse(rawBody));
  } catch {
    message = null;
  }
  if (!message) {
    // Retrying won't fix it.
    console.error("[reminders] ignoring an invalid message", rawBody);
    return new Response(null, { status: 200 });
  }

  try {
    const result = await deliverReminder(message);
    return Response.json({ result });
  } catch (error) {
    console.error("[reminders] couldn't deliver", message, error);
    return new Response(null, { status: 500 });
  }
}
