-- CreateEnum
CREATE TYPE "NoteKind" AS ENUM ('TIMED', 'ALL_DAY');

-- AlterTable
ALTER TABLE "Note" ADD COLUMN     "kind" "NoteKind" NOT NULL DEFAULT 'ALL_DAY',
ADD COLUMN     "startsAt" TIMESTAMPTZ(3);

-- CreateIndex
CREATE INDEX "Note_userId_startsAt_idx" ON "Note"("userId", "startsAt");


-- Backfill. `date` and `time` are dropped by the next migration, in the same deploy.
-- Notes with a time were written in the owner's zone, which is `User.timeZone`
-- (every production account is in Argentina); notes without one keep their
-- day as 00:00 UTC. Browsers may report zone aliases Postgres doesn't know
-- (e.g. America/Cordoba), which would abort the migration, so those fall back
-- to Buenos Aires (same offset).
UPDATE "Note" AS n
SET "kind" = CASE WHEN n."time" IS NULL THEN 'ALL_DAY'::"NoteKind" ELSE 'TIMED'::"NoteKind" END,
    "startsAt" = CASE
      WHEN n."time" IS NULL THEN n."date"::timestamp AT TIME ZONE 'UTC'
      WHEN u."timeZone" IN (SELECT "name" FROM pg_timezone_names)
        THEN (n."date" + n."time"::time) AT TIME ZONE u."timeZone"
      ELSE (n."date" + n."time"::time) AT TIME ZONE 'America/Argentina/Buenos_Aires'
    END
FROM "User" AS u
WHERE u."id" = n."userId" AND n."date" IS NOT NULL;
