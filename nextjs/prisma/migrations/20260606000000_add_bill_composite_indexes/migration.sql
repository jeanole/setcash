-- Composite indexes for the two most common Bill query patterns:
-- filtering by project + status (spending/budget/export queries) and
-- project + date (user PDF report ordering).

-- CreateIndex
CREATE INDEX "Bill_projectId_status_idx" ON "Bill"("projectId", "status");

-- CreateIndex
CREATE INDEX "Bill_projectId_date_idx" ON "Bill"("projectId", "date");
