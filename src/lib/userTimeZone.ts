import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
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

/** `getUserTimeZone` for a user id, reading their stored zone. */
export async function getTimeZoneForUser(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timeZone: true } });
  return getUserTimeZone(user?.timeZone);
}
