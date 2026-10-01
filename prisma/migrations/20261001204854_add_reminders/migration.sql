-- AlterTable
ALTER TABLE "Note" ADD COLUMN     "reminderSentFor" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "digestEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "digestSentOn" TEXT,
ADD COLUMN     "digestTime" TEXT NOT NULL DEFAULT '07:00',
ADD COLUMN     "reminderMinutesBefore" INTEGER;
