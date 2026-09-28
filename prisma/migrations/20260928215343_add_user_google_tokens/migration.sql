-- AlterTable
ALTER TABLE "User" ADD COLUMN     "googleAccessToken" TEXT,
ADD COLUMN     "googleAccessTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "googleRefreshToken" TEXT;
