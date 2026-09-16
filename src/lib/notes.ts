import { prisma } from "@/lib/prisma";

/**
 * Notes scheduled within a week's [start, end) range, ordered for display
 * on the board. Uses the [userId, scheduledAt] composite index.
 */
export function getNotesForWeek(userId: string, weekStart: Date, weekEnd: Date) {
  return prisma.note.findMany({
    where: {
      userId,
      isDraft: false,
      scheduledAt: { gte: weekStart, lt: weekEnd },
    },
    orderBy: [{ scheduledAt: "asc" }, { position: "asc" }],
  });
}
