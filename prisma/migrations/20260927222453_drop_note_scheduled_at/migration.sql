-- DropIndex
DROP INDEX "Note_userId_scheduledAt_idx";

-- AlterTable
ALTER TABLE "Note" DROP COLUMN "hasTime",
DROP COLUMN "scheduledAt";

