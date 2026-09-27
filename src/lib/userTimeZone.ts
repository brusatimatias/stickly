import { headers } from "next/headers";
import { resolveTimeZone } from "@/lib/timezone";

/**
 * The time zone to use for a user on this request: the one their browser
 * last reported (`User.timeZone`), else the one Vercel infers from the IP,
 * else UTC. Server-only (reads request headers).
 */
export async function getUserTimeZone(stored: string | null | undefined): Promise<string> {
  const ipTimeZone = (await headers()).get("x-vercel-ip-timezone");
  return resolveTimeZone(stored, ipTimeZone);
}
