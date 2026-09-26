-- CreateTable
CREATE TABLE "WebChatUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebChatUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebChatUsage_userId_createdAt_idx" ON "WebChatUsage"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "WebChatUsage_createdAt_idx" ON "WebChatUsage"("createdAt");

-- AddForeignKey
ALTER TABLE "WebChatUsage" ADD CONSTRAINT "WebChatUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
