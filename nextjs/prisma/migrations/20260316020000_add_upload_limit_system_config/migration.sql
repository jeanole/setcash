ALTER TABLE "Project" ADD COLUMN "uploadLimit" INTEGER;

CREATE TABLE "SystemConfig" (
    "key"   TEXT NOT NULL,
    "value" TEXT,
    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("key")
);
