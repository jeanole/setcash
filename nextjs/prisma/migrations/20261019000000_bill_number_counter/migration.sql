-- CreateTable: persistent per-(project, user) bill number counter so numbers are never reused
CREATE TABLE "BillNumberCounter" (
    "projectId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "lastIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BillNumberCounter_pkey" PRIMARY KEY ("projectId","userEmail")
);

-- AddForeignKey
ALTER TABLE "BillNumberCounter" ADD CONSTRAINT "BillNumberCounter_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: lastIndex = highest ordinal among the user's existing bills.
-- billNumber "G.PP" has ordinal (G - 1) * 20 + PP (1.01 -> 1, 1.20 -> 20, 2.01 -> 21).
-- Numbers in any other format (e.g. "TG-...") are ignored. Emails are stored lower-cased.
INSERT INTO "BillNumberCounter" ("projectId", "userEmail", "lastIndex")
SELECT
    "projectId",
    lower("submittedByEmail"),
    MAX((split_part("billNumber", '.', 1)::INTEGER - 1) * 20 + split_part("billNumber", '.', 2)::INTEGER)
FROM "Bill"
WHERE "billNumber" ~ '^[0-9]{1,6}\.[0-9]{2}$'
GROUP BY "projectId", lower("submittedByEmail");
