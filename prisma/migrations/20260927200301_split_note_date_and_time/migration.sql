-- AlterTable
ALTER TABLE "Note" ADD COLUMN     "date" DATE,
ADD COLUMN     "time" VARCHAR(5);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "timeZone" TEXT;

-- CreateIndex
CREATE INDEX "Note_userId_date_idx" ON "Note"("userId", "date");

-- Backfill. In production `scheduledAt` holds the wall-clock time as written
-- (the server ran in UTC, so "22:00" was stored as 22:00), which is exactly
-- what `date` + `time` now keep, so it's a straight copy with no zone math.
-- Databases written by a server in another zone (local dev) end up shifted;
-- reseed those with `npm run db:seed`.
UPDATE "Note"
SET "date" = "scheduledAt"::date,
    "time" = CASE WHEN "hasTime" THEN to_char("scheduledAt", 'HH24:MI') END
WHERE "isDraft" = false AND "scheduledAt" IS NOT NULL;

-- Every existing account is in Argentina; the browser corrects it on the next visit otherwise.
UPDATE "User" SET "timeZone" = 'America/Argentina/Buenos_Aires' WHERE "timeZone" IS NULL;
