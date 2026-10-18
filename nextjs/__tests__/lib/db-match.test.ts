/**
 * Integration tests for insensitiveEquals (BUG-24): case-insensitive lookups
 * must match exactly, never treat `_` or `%` as wildcards.
 */

import { db } from '@/lib/db';
import { insensitiveEquals, escapeLikePattern } from '@/lib/db-match';

describe('insensitiveEquals', () => {
  const suffix = Date.now();
  const victim = `su-per${suffix}@qa.test`;
  const underscored = `under_score${suffix}@qa.test`;

  beforeAll(async () => {
    await db.user.createMany({
      data: [
        { email: victim, passwordHash: '' },
        { email: underscored, passwordHash: '' },
      ],
    });
  });

  afterAll(async () => {
    await db.user.deleteMany({ where: { email: { in: [victim, underscored] } } });
  });

  it('should match regardless of letter case', async () => {
    const user = await db.user.findFirst({ where: { email: insensitiveEquals(victim.toUpperCase()) } });

    expect(user?.email).toBe(victim);
  });

  it('should not treat _ as a single-character wildcard', async () => {
    const user = await db.user.findFirst({ where: { email: insensitiveEquals(`su_per${suffix}@qa.test`) } });

    expect(user).toBeNull();
  });

  it('should not treat % as a wildcard', async () => {
    const user = await db.user.findFirst({ where: { email: insensitiveEquals(`su%@qa.test`) } });

    expect(user).toBeNull();
  });

  it('should still find an address that really contains _', async () => {
    const user = await db.user.findFirst({ where: { email: insensitiveEquals(underscored.toUpperCase()) } });

    expect(user?.email).toBe(underscored);
  });

  it('should escape backslashes, percent signs and underscores', () => {
    expect(escapeLikePattern('a\\b%c_d')).toBe('a\\\\b\\%c\\_d');
  });
});
