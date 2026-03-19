-- Add browser, OS, screen size, language, and session tracking fields

ALTER TABLE "VisitLog" ADD COLUMN "browser" TEXT;
ALTER TABLE "VisitLog" ADD COLUMN "os" TEXT;
ALTER TABLE "VisitLog" ADD COLUMN "screenWidth" INTEGER;
ALTER TABLE "VisitLog" ADD COLUMN "screenHeight" INTEGER;
ALTER TABLE "VisitLog" ADD COLUMN "language" TEXT;
ALTER TABLE "VisitLog" ADD COLUMN "sessionId" TEXT;

ALTER TABLE "PageEvent" ADD COLUMN "sessionId" TEXT;
