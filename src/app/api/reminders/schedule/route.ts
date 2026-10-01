import type { NextRequest } from "next/server";
import { isValidCronRequest } from "@/lib/cronAuth";
import { isQStashConfigured } from "@/lib/qstash";
import { queueAllReminders } from "@/lib/reminders";

// One QStash call per reminder of the next 48 h, for every user.
export const maxDuration = 60;

/**
 * Vercel Cron, once a day (see vercel.json): queues the reminders and digests
 * of the next 48 h in QStash, which delivers each one at its time.
 */
export async function GET(request: NextRequest) {
  if (!isValidCronRequest(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response(null, { status: 401 });
  }
  if (!isQStashConfigured()) {
    console.warn("[reminders] QStash isn't configured, nothing queued");
    return Response.json({ users: 0, queued: 0 });
  }
  return Response.json(await queueAllReminders());
}
