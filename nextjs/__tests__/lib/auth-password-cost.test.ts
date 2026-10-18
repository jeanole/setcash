/**
 * Credentials sign-in hash-cost handling (BUG-11, real DB).
 * Hashes whose cost is not 12 are upgraded after a successful login, and a
 * wrong password against a cheaper hash is padded so it is not measurably
 * faster than the unknown-email path.
 */

import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { authorizeCredentials, bcryptCost } from '@/auth';

const PASSWORD = 'Sup3rSecret!';

function median(values: number[]): number {
  return [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
}

async function timed(fn: () => Promise<unknown>): Promise<number> {
  const start = process.hrtime.bigint();
  await fn();
  return Number(process.hrtime.bigint() - start) / 1e6;
}

describe('bcryptCost', () => {
  it('should parse the cost of $2a$ and $2b$ hashes', () => {
    expect(bcryptCost('$2a$10$abcdefghijklmnopqrstuuabcdefghijklmnopqrstuvwxyz01234')).toBe(10);
    expect(bcryptCost('$2b$12$abcdefghijklmnopqrstuuabcdefghijklmnopqrstuvwxyz01234')).toBe(12);
  });

  it('should return null for non-bcrypt values', () => {
    expect(bcryptCost('')).toBeNull();
    expect(bcryptCost('plaintext')).toBeNull();
  });
});

describe('authorizeCredentials hash cost', () => {
  const suffix = Math.random().toString(36).slice(2, 8);
  const emails = {
    cost10: `cost10-${suffix}@example.com`,
    cost12: `cost12-${suffix}@example.com`,
    cost14: `cost14-${suffix}@example.com`,
  };

  beforeAll(async () => {
    const make = async (email: string, cost: number) =>
      db.user.create({
        data: {
          email,
          passwordHash: await bcrypt.hash(PASSWORD, cost),
          emailVerified: new Date(),
        },
      });
    await make(emails.cost10, 10);
    await make(emails.cost12, 12);
    await make(emails.cost14, 14);
  });

  afterAll(async () => {
    await db.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
  });

  it('should re-hash a cost-10 password at cost 12 after a successful login', async () => {
    const result = await authorizeCredentials({ email: emails.cost10, password: PASSWORD });

    const user = await db.user.findUniqueOrThrow({ where: { email: emails.cost10 } });
    expect(result?.email).toBe(emails.cost10);
    expect(bcryptCost(user.passwordHash)).toBe(12);
    expect(await bcrypt.compare(PASSWORD, user.passwordHash)).toBe(true);
  });

  it('should re-hash a cost-14 password down to cost 12 after a successful login', async () => {
    await authorizeCredentials({ email: emails.cost14, password: PASSWORD });

    const user = await db.user.findUniqueOrThrow({ where: { email: emails.cost14 } });
    expect(bcryptCost(user.passwordHash)).toBe(12);
  });

  it('should leave a cost-12 hash untouched', async () => {
    const before = await db.user.findUniqueOrThrow({ where: { email: emails.cost12 } });

    await authorizeCredentials({ email: emails.cost12, password: PASSWORD });

    const after = await db.user.findUniqueOrThrow({ where: { email: emails.cost12 } });
    expect(after.passwordHash).toBe(before.passwordHash);
  });

  it('should not change the hash after a failed login', async () => {
    const weak = `weak-${suffix}@example.com`;
    const hash = await bcrypt.hash(PASSWORD, 10);
    await db.user.create({ data: { email: weak, passwordHash: hash, emailVerified: new Date() } });

    const result = await authorizeCredentials({ email: weak, password: 'wrong-password' });

    const user = await db.user.findUniqueOrThrow({ where: { email: weak } });
    expect(result).toBeNull();
    expect(user.passwordHash).toBe(hash);
    await db.user.delete({ where: { email: weak } });
  });

  it('should take about as long to reject a wrong password on a cost-10 account as an unknown email', async () => {
    const weak = `timing-${suffix}@example.com`;
    await db.user.create({
      data: { email: weak, passwordHash: await bcrypt.hash(PASSWORD, 10), emailVerified: new Date() },
    });

    const unknown: number[] = [];
    const wrong: number[] = [];
    for (let i = 0; i < 3; i++) {
      unknown.push(await timed(() => authorizeCredentials({ email: `nobody-${suffix}@example.com`, password: 'x1' })));
      wrong.push(await timed(() => authorizeCredentials({ email: weak, password: 'x1' })));
    }

    // Unpadded, a cost-10 compare is ~25% of a cost-12 one
    expect(median(wrong)).toBeGreaterThan(median(unknown) * 0.6);
    await db.user.delete({ where: { email: weak } });
  });
});
