/**
 * Integration test for the case-insensitive unique index on User.email
 * (migration 20261018120000_user_email_case_insensitive_unique).
 */

import { db } from '@/lib/db';

describe('User email uniqueness', () => {
  const email = `Case-${Date.now()}@Example.com`;

  afterAll(async () => {
    await db.user.deleteMany({ where: { email: { equals: email, mode: 'insensitive' } } });
  });

  it('should reject a second account whose email differs only in letter case', async () => {
    await db.user.create({ data: { email, passwordHash: '' } });

    await expect(
      db.user.create({ data: { email: email.toLowerCase(), passwordHash: '' } })
    ).rejects.toMatchObject({ code: 'P2002' });
  });
});
