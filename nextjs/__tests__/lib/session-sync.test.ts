/**
 * Integration tests for syncTokenWithDb (auth.ts jwt callback, real DB).
 *
 * The JWT must reflect the database on every request: demotions, removals,
 * deactivation and password changes take effect without a fresh sign-in.
 */

import type { JWT } from '@auth/core/jwt';
import { db } from '@/lib/db';
import { syncTokenWithDb } from '@/auth';
import { createTestContext, cleanupTestContext, TestContext } from '../helpers';

function baseToken(ctx: TestContext, overrides: Partial<JWT> = {}): JWT {
  return {
    id: ctx.userId,
    email: ctx.userEmail,
    role: 'admin',
    currentProjectId: ctx.projectId,
    currentProjectRole: 'admin',
    currentProjectName: 'Test Project',
    isExampleProject: false,
    isDemoAccount: false,
    hasSeenTour: false,
    sessionVersion: 0,
    ...overrides,
  };
}

describe('syncTokenWithDb', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
    await db.user.update({
      where: { email: ctx.userEmail },
      data: { defaultProjectId: ctx.projectId, emailVerified: new Date() },
    });
  });

  afterEach(async () => {
    await db.user.updateMany({ where: { email: ctx.userEmail }, data: { defaultProjectId: null } });
    await cleanupTestContext(ctx);
  });

  it('should keep a valid admin session unchanged', async () => {
    const token = await syncTokenWithDb(baseToken(ctx), false);

    expect(token).toMatchObject({ role: 'admin', currentProjectId: ctx.projectId, currentProjectRole: 'admin' });
  });

  it('should downgrade the role after a demotion', async () => {
    await db.projectMember.update({
      where: { projectId_userEmail: { projectId: ctx.projectId, userEmail: ctx.userEmail } },
      data: { role: 'user' },
    });

    const token = await syncTokenWithDb(baseToken(ctx), false);

    expect(token).toMatchObject({ role: 'user', currentProjectRole: 'user' });
  });

  it('should clear the project context after the member is removed', async () => {
    await db.projectMember.delete({
      where: { projectId_userEmail: { projectId: ctx.projectId, userEmail: ctx.userEmail } },
    });

    const token = await syncTokenWithDb(baseToken(ctx), false);

    expect(token).toMatchObject({ role: 'user', currentProjectId: null, currentProjectRole: null });
  });

  it('should remove superadmin when the DB flag is cleared', async () => {
    const token = await syncTokenWithDb(baseToken(ctx, { role: 'superadmin' }), false);

    expect(token?.role).toBe('admin');
  });

  it('should end the session for a deactivated user', async () => {
    await db.user.update({ where: { email: ctx.userEmail }, data: { isActive: false } });

    await expect(syncTokenWithDb(baseToken(ctx), false)).resolves.toBeNull();
  });

  it('should end the session for a deleted user', async () => {
    await expect(syncTokenWithDb(baseToken(ctx, { email: 'gone@example.com' }), false)).resolves.toBeNull();
  });

  it('should end sessions issued before a password change', async () => {
    await db.user.update({ where: { email: ctx.userEmail }, data: { sessionVersion: { increment: 1 } } });

    await expect(syncTokenWithDb(baseToken(ctx, { sessionVersion: 0 }), false)).resolves.toBeNull();
  });

  it('should treat tokens issued before sessionVersion existed as version 0', async () => {
    const token = await syncTokenWithDb(baseToken(ctx, { sessionVersion: undefined }), false);

    expect(token).not.toBeNull();
  });

  it('should stamp the current sessionVersion and DB id on sign-in', async () => {
    await db.user.update({ where: { email: ctx.userEmail }, data: { sessionVersion: 3 } });

    const token = await syncTokenWithDb(baseToken(ctx, { id: 'google-profile-id', sessionVersion: undefined }), true);

    expect(token).toMatchObject({ id: ctx.userId, sessionVersion: 3 });
  });
});
