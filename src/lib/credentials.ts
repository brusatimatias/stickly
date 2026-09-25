import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

/**
 * A valid bcrypt hash (cost 10, same as real passwords) of a random value
 * nobody knows. Comparing against it when the user doesn't exist makes a
 * failed login take as long as a wrong password, so response time doesn't
 * reveal which emails have an account.
 */
const DUMMY_PASSWORD_HASH = "$2b$10$f/1SYaDdGKh2EPahz4kNb.5PErtjhYlbzBEji9jRIEKFF3HCga49O";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Email/password check for the Credentials provider. Returns the user id on
 * success and null on any failure, without saying which part was wrong.
 */
export async function authorizeCredentials(
  email: unknown,
  password: unknown
): Promise<{ id: string } | null> {
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return null;
  }

  // Emails are stored normalized (see the Google upsert in src/auth.ts), but
  // rows written before that may still have mixed case.
  const user = await prisma.user.findFirst({
    where: { email: { equals: normalizeEmail(email), mode: "insensitive" } },
    select: { id: true, password: true },
  });

  const passwordMatches = await bcrypt.compare(password, user?.password ?? DUMMY_PASSWORD_HASH);
  if (!user?.password || !passwordMatches) {
    return null;
  }
  return { id: user.id };
}
