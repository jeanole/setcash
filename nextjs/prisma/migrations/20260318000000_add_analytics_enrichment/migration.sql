-- AlterTable: add referrer + UTM fields to VisitLog
ALTER TABLE "VisitLog"
    ADD COLUMN "referrer"    TEXT,
    ADD COLUMN "utmSource"   TEXT,
    ADD COLUMN "utmMedium"   TEXT,
    ADD COLUMN "utmCampaign" TEXT;

-- CreateTable: PageEvent
CREATE TABLE "PageEvent" (
    "id"              TEXT NOT NULL,
    "timestamp"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "countryCode"     TEXT,
    "deviceType"      TEXT NOT NULL,
    "path"            TEXT NOT NULL,
    "eventType"       TEXT NOT NULL,
    "eventLabel"      TEXT,
    "isAuthenticated" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PageEvent_timestamp_idx" ON "PageEvent"("timestamp");

-- CreateIndex
CREATE INDEX "PageEvent_eventType_idx" ON "PageEvent"("eventType");
