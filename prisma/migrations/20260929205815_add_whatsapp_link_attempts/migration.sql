-- DropIndex
DROP INDEX "WhatsAppInboundMessage_from_createdAt_idx";

-- AlterTable
ALTER TABLE "WhatsAppInboundMessage" ADD COLUMN     "isLinkAttempt" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "WhatsAppInboundMessage_from_isLinkAttempt_createdAt_idx" ON "WhatsAppInboundMessage"("from", "isLinkAttempt", "createdAt");

