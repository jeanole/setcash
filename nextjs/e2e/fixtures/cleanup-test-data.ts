/**
 * Cleanup E2E test data after test run
 */

import { PrismaClient } from '@prisma/client';
import { USERS, PROJECTS } from './constants';

const prisma = new PrismaClient();

async function cleanup() {
  console.log('[E2E Cleanup] Removing test data...');

  const e2eEmails = Object.values(USERS).map((u) => u.email);
  const projectNames = Object.values(PROJECTS).map((p) => p.name);

  // Delete in correct order (projects cascade deletes memberships, bills, etc.)
  await prisma.project.deleteMany({ where: { name: { in: projectNames } } });
  await prisma.user.deleteMany({ where: { email: { in: e2eEmails } } });

  console.log('[E2E Cleanup] Done!');
}

cleanup()
  .catch((e) => {
    console.error('[E2E Cleanup] Error:', e);
    // Don't exit(1) — teardown failures shouldn't fail the run
  })
  .finally(() => prisma.$disconnect());
