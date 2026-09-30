"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { LINK_CODE_TTL_MS, generateLinkCode, hashLinkCode } from "@/lib/whatsappLink";

// Two users holding the same pending code is unlikely (a million codes, ten
// minutes each), so a couple of tries is plenty.
const MAX_CODE_ATTEMPTS = 3;

/**
 * Prisma's unique constraint violation (P2002). On the link code upsert it can
 * only be `codeHash`: the other unique key, `userId`, is the upsert's `where`.
 */
function isUniqueViolation(error: unknown) {
  return (error as { code?: unknown } | null)?.code === "P2002";
}

/**
 * Generates the code the user sends from WhatsApp to link their number,
 * replacing any pending one. Only its hash is stored, so this is the only
 * time the code is available. An already linked user may generate one too:
 * sending it from another number moves the link there. Nothing server
 * rendered shows the code, so there's no path to revalidate.
 */
export async function createWhatsAppLinkCode(): Promise<{ code: string; expiresAt: Date }> {
  const userId = await requireUserId();

  for (let attempt = 1; ; attempt++) {
    const code = generateLinkCode();
    const codeHash = hashLinkCode(code);
    const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MS);
    try {
      await prisma.whatsAppLinkCode.upsert({
        where: { userId },
        create: { userId, codeHash, expiresAt },
        update: { codeHash, expiresAt, createdAt: new Date() },
      });
      return { code, expiresAt };
    } catch (error) {
      // Another user's pending code has the same hash: draw a new one.
      if (!isUniqueViolation(error) || attempt >= MAX_CODE_ATTEMPTS) {
        throw error;
      }
    }
  }
}

/** Unlinks the user's WhatsApp number and forgets its pending code and conversation. */
export async function unlinkWhatsApp() {
  const userId = await requireUserId();

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { whatsappNumber: null } }),
    prisma.whatsAppLinkCode.deleteMany({ where: { userId } }),
    prisma.whatsAppMessage.deleteMany({ where: { userId } }),
  ]);
  revalidatePath("/profile");
}
