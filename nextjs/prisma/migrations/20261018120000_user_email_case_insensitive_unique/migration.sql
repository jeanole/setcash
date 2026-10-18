-- Enforce one account per email regardless of letter case.
--
-- Prisma cannot express an index on LOWER(email), so it lives only in this
-- migration. If existing rows already differ only in case, the migration stops
-- with a clear error instead of half-applying. Find them with:
--   SELECT LOWER(email), array_agg(email) FROM "User"
--   GROUP BY LOWER(email) HAVING COUNT(*) > 1;
-- and merge/rename the duplicates before deploying.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "User" GROUP BY LOWER("email") HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'User emails that differ only in letter case exist; merge them before applying this migration (see migration.sql for the query).';
  END IF;
END $$;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_lower_key" ON "User"(LOWER("email"));
