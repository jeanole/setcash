/**
 * Integration tests for BUG-24: an address that differs from another only by
 * `_` (or `%`) must never resolve to that other account — not via Google
 * sign-in, not via the credentials login.
 */

import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { authorizeCredentials, resolveGoogleSignIn } from '@/auth';

describe('email lookups do not treat _ or % as wildcards (BUG-24)', () => {
  const suffix = Date.now();
  const victim = `super${suffix}@qa.test`;
  const mixedCase = `Mixed.Case${suffix}@QA.test`;
  const lookalike = `sup_r${suffix}@qa.test`;
  const created: string[] = [];

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash('Victim-Pass-1', 4);
    await db.user.createMany({
      data: [
        { email: victim, passwordHash, emailVerified: new Date(), isSuperAdmin: true },
        { email: mixedCase, passwordHash, emailVerified: new Date() },
      ],
    });
  });

  afterAll(async () => {
    await db.user.deleteMany({ where: { email: { in: [victim, mixedCase, lookalike, ...created] } } });
  });

  it('should not resolve a Google identity to an account that only matches as a pattern', async () => {
    const user = { email: lookalike };

    await expect(resolveGoogleSignIn(user)).resolves.toBe(true);

    expect(user.email).toBe(lookalike);
    const account = await db.user.findUnique({ where: { email: lookalike } });
    expect(account).toMatchObject({ isSuperAdmin: false });
  });

  it('should still resolve a Google identity to the stored mixed-case account', async () => {
    const user = { email: mixedCase.toLowerCase() };

    await expect(resolveGoogleSignIn(user)).resolves.toBe(true);

    expect(user.email).toBe(mixedCase);
  });

  it('should not log in with an underscore variant of another address', async () => {
    const variant = `su_er${suffix}@qa.test`;

    await expect(authorizeCredentials({ email: variant, password: 'Victim-Pass-1' })).resolves.toBeNull();
  });

  it('should not log in with a percent pattern', async () => {
    await expect(authorizeCredentials({ email: `s%${suffix}@qa.test`, password: 'Victim-Pass-1' })).resolves.toBeNull();
  });

  it('should log in with the real address in any letter case', async () => {
    const result = await authorizeCredentials({ email: victim.toUpperCase(), password: 'Victim-Pass-1' });

    expect(result?.email).toBe(victim);
  });
});
