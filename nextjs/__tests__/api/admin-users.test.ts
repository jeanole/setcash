/**
 * Superadmin user management: session revocation on password reset (BUG-3)
 * and sign-in ability of created users (BUG-10). Real DB, mocked session.
 */

import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { auth, authorizeCredentials } from '@/auth';
import { db } from '@/lib/db';

jest.mock('@/auth', () => ({
  ...jest.requireActual('@/auth'),
  auth: jest.fn(),
}));
const mockAuth = auth as unknown as jest.Mock;

/* eslint-disable @typescript-eslint/no-require-imports */
const usersRoute = require('@/app/api/admin/users/route') as typeof import('@/app/api/admin/users/route');
const userRoute = require('@/app/api/admin/users/[email]/route') as typeof import('@/app/api/admin/users/[email]/route');
/* eslint-enable @typescript-eslint/no-require-imports */

function jsonReq(url: string, method: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('admin users API', () => {
  const suffix = Math.random().toString(36).slice(2, 8);
  const adminEmail = `super-${suffix}@example.com`;
  const targetEmail = `target-${suffix}@example.com`;
  const createdEmail = `Created-${suffix}@Example.com`;

  beforeAll(async () => {
    await db.user.create({
      data: {
        email: adminEmail,
        passwordHash: await bcrypt.hash('Whatever1', 4),
        isSuperAdmin: true,
        emailVerified: new Date(),
      },
    });
    await db.user.create({
      data: {
        email: targetEmail,
        passwordHash: await bcrypt.hash('OldPassw0rd', 4),
        emailVerified: new Date(),
      },
    });
  });

  beforeEach(() => {
    mockAuth.mockResolvedValue({ user: { id: 'x', email: adminEmail, role: 'superadmin' } });
  });

  afterAll(async () => {
    await db.user.deleteMany({
      where: { email: { in: [adminEmail, targetEmail, createdEmail.toLowerCase()] } },
    });
  });

  describe('PUT /api/admin/users/[email]', () => {
    it('should increment sessionVersion on resetPassword', async () => {
      const before = await db.user.findUniqueOrThrow({ where: { email: targetEmail } });

      const res = await userRoute.PUT(
        jsonReq('http://localhost/api/admin/users/x', 'PUT', { resetPassword: true }),
        { params: Promise.resolve({ email: targetEmail }) }
      );

      const after = await db.user.findUniqueOrThrow({ where: { email: targetEmail } });
      expect(res.status).toBe(200);
      expect(after.sessionVersion).toBe(before.sessionVersion + 1);
    });

    it('should increment sessionVersion when setting a custom password', async () => {
      const before = await db.user.findUniqueOrThrow({ where: { email: targetEmail } });

      const res = await userRoute.PUT(
        jsonReq('http://localhost/api/admin/users/x', 'PUT', { password: 'Custom0Passw' }),
        { params: Promise.resolve({ email: targetEmail }) }
      );

      const after = await db.user.findUniqueOrThrow({ where: { email: targetEmail } });
      expect(res.status).toBe(200);
      expect(after.sessionVersion).toBe(before.sessionVersion + 1);
    });

    it('should not touch sessionVersion when only the superadmin flag changes', async () => {
      const before = await db.user.findUniqueOrThrow({ where: { email: targetEmail } });

      const res = await userRoute.PUT(
        jsonReq('http://localhost/api/admin/users/x', 'PUT', { isSuperAdmin: false }),
        { params: Promise.resolve({ email: targetEmail }) }
      );

      const after = await db.user.findUniqueOrThrow({ where: { email: targetEmail } });
      expect(res.status).toBe(200);
      expect(after.sessionVersion).toBe(before.sessionVersion);
    });
  });

  describe('POST /api/admin/users', () => {
    it('should create a verified, lowercased user who can sign in', async () => {
      const res = await usersRoute.POST(
        jsonReq('http://localhost/api/admin/users', 'POST', {
          email: createdEmail,
          password: 'Created0Pw',
        })
      );
      expect(res.status).toBe(200);

      const user = await db.user.findUniqueOrThrow({ where: { email: createdEmail.toLowerCase() } });
      expect(user.emailVerified).not.toBeNull();

      const signedIn = await authorizeCredentials({ email: createdEmail, password: 'Created0Pw' });
      expect(signedIn?.email).toBe(createdEmail.toLowerCase());
    });
  });
});
