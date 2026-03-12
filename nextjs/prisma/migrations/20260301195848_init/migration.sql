-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('confirmed', 'pending', 'approved', 'rejected', 'paid');

-- CreateEnum
CREATE TYPE "OcrStatus" AS ENUM ('pending', 'done', 'failed');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "defaultProjectId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "name" TEXT NOT NULL,
    "subtitle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "projectId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "role" "ProjectRole" NOT NULL DEFAULT 'user',
    "positionId" TEXT,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectPosition" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ProjectPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectSettings" (
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT,

    CONSTRAINT "ProjectSettings_pkey" PRIMARY KEY ("projectId","key")
);

-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "projectId" TEXT NOT NULL,
    "submittedByEmail" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "billNumber" TEXT,
    "type" TEXT,
    "vendor" TEXT,
    "item" TEXT,
    "comment" TEXT,
    "motiveLegacy" TEXT,
    "brutto19" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "brutto7" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "brutto0" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "nettoAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "grossAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" "BillStatus" NOT NULL DEFAULT 'confirmed',
    "ocrStatus" "OcrStatus",
    "ocrFields" JSONB,
    "telegramCaption" TEXT,
    "filename" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillImage" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "billId" TEXT NOT NULL,
    "filename" TEXT,
    "filePath" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillMotive" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "billId" TEXT NOT NULL,
    "motiveId" TEXT NOT NULL,
    "percentage" DECIMAL(65,30) NOT NULL DEFAULT 100,

    CONSTRAINT "BillMotive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillCategory" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "billId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "percentage" DECIMAL(65,30) NOT NULL DEFAULT 100,

    CONSTRAINT "BillCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Motive" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "budget" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "Motive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "budget" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetMatrix" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "projectId" TEXT NOT NULL,
    "motiveId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "BudgetMatrix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vgeld" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "projectId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "fromUser" TEXT,
    "toUser" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vgeld_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditLog" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "projectId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user" TEXT NOT NULL,
    "billId" TEXT,
    "changes" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'user',

    CONSTRAINT "EditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OcrLog" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "projectId" TEXT,
    "billId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "provider" TEXT,
    "status" TEXT,
    "fieldsWritten" JSONB,
    "aiResponse" JSONB,
    "errorDetail" TEXT,

    CONSTRAINT "OcrLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "userEmail" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "projectId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramLink" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "projectId" TEXT NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramLinkCode" (
    "code" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramLinkCode_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "ProjectMember_projectId_idx" ON "ProjectMember"("projectId");

-- CreateIndex
CREATE INDEX "ProjectMember_userEmail_idx" ON "ProjectMember"("userEmail");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_userEmail_key" ON "ProjectMember"("projectId", "userEmail");

-- CreateIndex
CREATE INDEX "ProjectPosition_projectId_idx" ON "ProjectPosition"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectPosition_projectId_name_key" ON "ProjectPosition"("projectId", "name");

-- CreateIndex
CREATE INDEX "ProjectSettings_projectId_idx" ON "ProjectSettings"("projectId");

-- CreateIndex
CREATE INDEX "Bill_projectId_idx" ON "Bill"("projectId");

-- CreateIndex
CREATE INDEX "Bill_submittedByEmail_idx" ON "Bill"("submittedByEmail");

-- CreateIndex
CREATE INDEX "Bill_status_idx" ON "Bill"("status");

-- CreateIndex
CREATE INDEX "BillImage_billId_idx" ON "BillImage"("billId");

-- CreateIndex
CREATE INDEX "BillMotive_billId_idx" ON "BillMotive"("billId");

-- CreateIndex
CREATE INDEX "BillMotive_motiveId_idx" ON "BillMotive"("motiveId");

-- CreateIndex
CREATE UNIQUE INDEX "BillMotive_billId_motiveId_key" ON "BillMotive"("billId", "motiveId");

-- CreateIndex
CREATE INDEX "BillCategory_billId_idx" ON "BillCategory"("billId");

-- CreateIndex
CREATE INDEX "BillCategory_categoryId_idx" ON "BillCategory"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "BillCategory_billId_categoryId_key" ON "BillCategory"("billId", "categoryId");

-- CreateIndex
CREATE INDEX "Motive_projectId_idx" ON "Motive"("projectId");

-- CreateIndex
CREATE INDEX "Category_projectId_idx" ON "Category"("projectId");

-- CreateIndex
CREATE INDEX "BudgetMatrix_projectId_idx" ON "BudgetMatrix"("projectId");

-- CreateIndex
CREATE INDEX "BudgetMatrix_motiveId_idx" ON "BudgetMatrix"("motiveId");

-- CreateIndex
CREATE INDEX "BudgetMatrix_categoryId_idx" ON "BudgetMatrix"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetMatrix_projectId_motiveId_categoryId_key" ON "BudgetMatrix"("projectId", "motiveId", "categoryId");

-- CreateIndex
CREATE INDEX "Vgeld_projectId_idx" ON "Vgeld"("projectId");

-- CreateIndex
CREATE INDEX "EditLog_projectId_idx" ON "EditLog"("projectId");

-- CreateIndex
CREATE INDEX "EditLog_billId_idx" ON "EditLog"("billId");

-- CreateIndex
CREATE INDEX "OcrLog_projectId_idx" ON "OcrLog"("projectId");

-- CreateIndex
CREATE INDEX "OcrLog_billId_idx" ON "OcrLog"("billId");

-- CreateIndex
CREATE INDEX "Notification_userEmail_idx" ON "Notification"("userEmail");

-- CreateIndex
CREATE INDEX "Notification_projectId_idx" ON "Notification"("projectId");

-- CreateIndex
CREATE INDEX "TelegramLink_projectId_idx" ON "TelegramLink"("projectId");

-- CreateIndex
CREATE INDEX "TelegramLink_userEmail_idx" ON "TelegramLink"("userEmail");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramLink_projectId_telegramUserId_key" ON "TelegramLink"("projectId", "telegramUserId");

-- CreateIndex
CREATE INDEX "TelegramLinkCode_userEmail_idx" ON "TelegramLinkCode"("userEmail");

-- CreateIndex
CREATE INDEX "TelegramLinkCode_projectId_idx" ON "TelegramLinkCode"("projectId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_defaultProjectId_fkey" FOREIGN KEY ("defaultProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "ProjectPosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPosition" ADD CONSTRAINT "ProjectPosition_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSettings" ADD CONSTRAINT "ProjectSettings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillImage" ADD CONSTRAINT "BillImage_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillMotive" ADD CONSTRAINT "BillMotive_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillMotive" ADD CONSTRAINT "BillMotive_motiveId_fkey" FOREIGN KEY ("motiveId") REFERENCES "Motive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillCategory" ADD CONSTRAINT "BillCategory_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillCategory" ADD CONSTRAINT "BillCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Motive" ADD CONSTRAINT "Motive_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetMatrix" ADD CONSTRAINT "BudgetMatrix_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetMatrix" ADD CONSTRAINT "BudgetMatrix_motiveId_fkey" FOREIGN KEY ("motiveId") REFERENCES "Motive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetMatrix" ADD CONSTRAINT "BudgetMatrix_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vgeld" ADD CONSTRAINT "Vgeld_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditLog" ADD CONSTRAINT "EditLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditLog" ADD CONSTRAINT "EditLog_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcrLog" ADD CONSTRAINT "OcrLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcrLog" ADD CONSTRAINT "OcrLog_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramLink" ADD CONSTRAINT "TelegramLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramLink" ADD CONSTRAINT "TelegramLink_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramLinkCode" ADD CONSTRAINT "TelegramLinkCode_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramLinkCode" ADD CONSTRAINT "TelegramLinkCode_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
