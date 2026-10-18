-- AlterTable: session version used to revoke JWTs after a password change/reset
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex: upload serving looks images up by path
CREATE INDEX "BillImage_filePath_idx" ON "BillImage"("filePath");
CREATE INDEX "Bill_filename_idx" ON "Bill"("filename");

-- CreateIndex: V-Geld balance/list queries
CREATE INDEX "Vgeld_projectId_toUser_idx" ON "Vgeld"("projectId", "toUser");
CREATE INDEX "Vgeld_projectId_date_idx" ON "Vgeld"("projectId", "date");

-- CreateIndex: notification list (userEmail filter, createdAt sort)
CREATE INDEX "Notification_userEmail_createdAt_idx" ON "Notification"("userEmail", "createdAt");
