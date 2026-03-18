/**
 * Shared test helpers — DB seeding and mock session factories.
 *
 * Typical usage in a test file:
 *   const ctx = await createTestContext();
 *   // ... run tests ...
 *   await cleanupTestContext(ctx);
 */

import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';

export interface TestContext {
  userId: string;
  userEmail: string;
  projectId: string;
}

/** Build a mock NextAuth session object for a regular project member. */
export function makeSession(ctx: TestContext, role: 'user' | 'admin' = 'user') {
  return {
    user: {
      id: ctx.userId,
      email: ctx.userEmail,
      name: 'Test User',
      role,
      currentProjectId: ctx.projectId,
      currentProjectRole: role,
      currentProjectName: 'Test Project',
      isExampleProject: false,
      isDemoAccount: false,
    },
  };
}

/** Create an isolated user + project + membership in the test DB. */
export async function createTestContext(): Promise<TestContext> {
  const suffix = Math.random().toString(36).slice(2, 8);
  const userEmail = `test-${suffix}@example.com`;

  const user = await db.user.create({
    data: {
      email: userEmail,
      passwordHash: await bcrypt.hash('password123', 1),
    },
  });

  const project = await db.project.create({
    data: { name: `Test Project ${suffix}` },
  });

  await db.projectMember.create({
    data: {
      projectId: project.id,
      userEmail: user.email,
      role: 'admin',
    },
  });

  return { userId: user.id, userEmail: user.email, projectId: project.id };
}

/** Delete the user, project (cascades members/bills/categories/motives). */
export async function cleanupTestContext(ctx: TestContext): Promise<void> {
  await db.project.deleteMany({ where: { id: ctx.projectId } });
  await db.user.deleteMany({ where: { email: ctx.userEmail } });
}

/** Build a plain JSON POST/PUT Request for route handlers. */
export function jsonRequest(url: string, method: string, body: unknown): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
