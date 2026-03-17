-- CreateTable
CREATE TABLE "VisitLog" (
    "id"          TEXT NOT NULL,
    "timestamp"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "countryCode" TEXT,
    "deviceType"  TEXT NOT NULL,
    "path"        TEXT NOT NULL,

    CONSTRAINT "VisitLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemoLoginAttempt" (
    "id"               TEXT NOT NULL,
    "timestamp"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "countryCode"      TEXT,
    "turnstileSuccess" BOOLEAN NOT NULL,
    "loginSuccess"     BOOLEAN NOT NULL,

    CONSTRAINT "DemoLoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VisitLog_timestamp_idx" ON "VisitLog"("timestamp");

-- CreateIndex
CREATE INDEX "DemoLoginAttempt_timestamp_idx" ON "DemoLoginAttempt"("timestamp");
