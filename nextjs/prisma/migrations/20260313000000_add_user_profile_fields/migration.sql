-- AlterTable
ALTER TABLE "User" ADD COLUMN "username" TEXT,
ADD COLUMN "firstName" TEXT,
ADD COLUMN "lastName" TEXT,
ADD COLUMN "mobile" TEXT;

-- CreateIndex (case-insensitive unique index to prevent duplicate usernames differing only by case)
CREATE UNIQUE INDEX "User_username_key" ON "User"(LOWER("username"));
