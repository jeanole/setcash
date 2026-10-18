/**
 * POST /api/projects/[id]/invite email handling (BUG-13, real DB).
 * Emails are matched case-insensitively against the stored address.
 */

import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { createTestContext, cleanupTestContext, makeSession, TestContext } from '../helpers';

jest.mock('@/auth');
jest.mock('@/lib/email', () => ({
  sendInvitationEmail: jest.fn().mockResolvedValue(undefined),
}));
const mockAuth = auth as jest.MockedFunction<typeof auth>;

/* eslint-disable @typescript-eslint/no-require-imports */
const route = require('@/app/api/projects/[id]/invite/route') as typeof import('@/app/api/projects/[id]/invite/route');
/* eslint-enable @typescript-eslint/no-require-imports */

function invite(ctx: TestContext, email: string) {
  return route.POST(
    new NextRequest(`http://localhost/api/projects/${ctx.projectId}/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }),
    { params: Promise.resolve({ id: ctx.projectId }) }
  );
}

describe('POST /api/projects/[id]/invite', () => {
  let ctx: TestContext;
  const suffix = Math.random().toString(36).slice(2, 8);
  const storedEmail = `Mixed.Case-${suffix}@QA.test`;
  const memberEmail = `Member-${suffix}@QA.test`;

  beforeAll(async () => {
    ctx = await createTestContext();
    const passwordHash = await bcrypt.hash('x', 1);
    await db.user.create({ data: { email: storedEmail, passwordHash, emailVerified: new Date() } });
    await db.user.create({ data: { email: memberEmail, passwordHash, emailVerified: new Date() } });
    await db.projectMember.create({
      data: { projectId: ctx.projectId, userEmail: memberEmail, role: 'user' },
    });
  });

  beforeEach(() => {
    mockAuth.mockResolvedValue(makeSession(ctx, 'admin') as never);
  });

  afterAll(async () => {
    await db.notification.deleteMany({ where: { userEmail: storedEmail } });
    await db.invitationToken.deleteMany({ where: { projectId: ctx.projectId } });
    await cleanupTestContext(ctx);
    await db.user.deleteMany({ where: { email: { in: [storedEmail, memberEmail] } } });
  });

  it('should notify the stored address when the invite email differs in case', async () => {
    const res = await invite(ctx, storedEmail.toLowerCase());

    const notifications = await db.notification.findMany({
      where: { userEmail: storedEmail, type: 'pending_invite', projectId: ctx.projectId },
    });
    expect(res.status).toBe(200);
    expect(notifications).toHaveLength(1);
  });

  it('should store the invitation token under the lowercased trimmed address', async () => {
    await invite(ctx, `  ${storedEmail.toUpperCase()}  `);

    const tokens = await db.invitationToken.findMany({ where: { projectId: ctx.projectId } });
    expect(tokens.map((t) => t.email)).toEqual([storedEmail.toLowerCase()]);
  });

  it('should reject an existing member invited with different letter case', async () => {
    const res = await invite(ctx, memberEmail.toUpperCase());

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/already a member/i);
  });
});
