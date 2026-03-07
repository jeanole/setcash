-- Add 'draft' value to BillStatus enum
-- This value was defined in the Prisma schema but missing from the initial PostgreSQL migration.
-- IF NOT EXISTS prevents failure if the value was already added manually.
ALTER TYPE "BillStatus" ADD VALUE IF NOT EXISTS 'draft';
