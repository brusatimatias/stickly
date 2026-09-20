"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { sanitizeName, validateAvatarDataUrl, validatePasswordLength } from "@/lib/profile";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

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

export async function setPassword(password: string) {
  const userId = await requireUserId();
  validatePasswordLength(password);

  const hashed = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } });
  revalidatePath("/profile");
}
