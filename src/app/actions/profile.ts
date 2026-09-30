"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { signIn } from "@/auth";
import {
  PASSWORD_RESET_PARAM,
  sanitizeName,
  validateAvatarDataUrl,
  validatePasswordLength,
} from "@/lib/profile";
import { prisma } from "@/lib/prisma";
import { hasRecentGoogleSignIn, requireUserId } from "@/lib/session";
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

/** Stores the time zone the browser reports (see `TimeZoneSync`), which the board shows notes in. */
export async function updateTimeZone(timeZone: string) {
  const userId = await requireUserId();
  if (!isValidTimeZone(timeZone)) {
    throw new Error("INVALID_TIME_ZONE");
  }

  await prisma.user.update({ where: { id: userId }, data: { timeZone } });
  revalidatePath("/");
}

/**
 * Sets the user's password. Changing an existing one needs the current one,
 * unless the session just signed in with Google: that proves it's the user as
 * well, and is how a Google user resets a forgotten password.
 */
export async function setPassword(password: string, currentPassword?: string) {
  const userId = await requireUserId();
  validatePasswordLength(password);

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { password: true },
  });
  if (user.password && !(await hasRecentGoogleSignIn())) {
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

/**
 * Signs in with Google again and comes back to the profile with the password
 * form open, where the recent sign in lets the user skip the current password.
 */
export async function confirmPasswordResetWithGoogle() {
  await requireUserId();
  await signIn("google", { redirectTo: `/profile?password=${PASSWORD_RESET_PARAM}` });
}
