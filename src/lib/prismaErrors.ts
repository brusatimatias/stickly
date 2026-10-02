/** Prisma's unique constraint violation (P2002). */
export function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === "P2002";
}
