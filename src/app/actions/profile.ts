"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { sanitizeName, validateAvatarDataUrl, validatePasswordLength } from "@/lib/profile";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { isValidTimeZone } from "@/lib/timezone";

export async function updateProfileName(name: string) {
  const userId = await requireUserId();
  const trimmed = sanitizeName(name);

  await prisma.user.update({ where: { id: userId }, data: { name: trimmed } });
  revalidatePath("/");
  revalidatePath("/profile");
}

export async function updateAvatar(dataUrl: string) {
  const userId = await requireUserId();
  validateAvatarDataUrl(dataUrl);

  await prisma.user.update({ where: { id: userId }, data: { avatarUrl: dataUrl } });
  revalidatePath("/");
  revalidatePath("/profile");
}

/** Stores the time zone the browser reports (see `TimeZoneSync`), used to work out "today". */
export async function updateTimeZone(timeZone: string) {
  const userId = await requireUserId();
  if (!isValidTimeZone(timeZone)) {
    throw new Error("INVALID_TIME_ZONE");
  }

  await prisma.user.update({ where: { id: userId }, data: { timeZone } });
  revalidatePath("/");
}

export async function setPassword(password: string, currentPassword?: string) {
  const userId = await requireUserId();
  validatePasswordLength(password);

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { password: true },
  });
  if (user.password) {
    if (!currentPassword) {
      throw new Error("CURRENT_PASSWORD_REQUIRED");
    }
    if (!(await bcrypt.compare(currentPassword, user.password))) {
      throw new Error("INVALID_CURRENT_PASSWORD");
    }
  }

  const hashed = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } });
  revalidatePath("/profile");
}
