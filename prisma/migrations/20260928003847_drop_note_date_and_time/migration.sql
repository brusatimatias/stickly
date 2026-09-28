-- DropIndex
DROP INDEX "Note_userId_date_idx";

-- AlterTable
ALTER TABLE "Note" DROP COLUMN "date",
DROP COLUMN "time";

