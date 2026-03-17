/**
 * Unit tests for the in-memory rate limiter (used when Upstash Redis is absent).
 * These tests run without a DB or Redis connection.
 */

// Import the internal class indirectly by clearing env vars before module load
const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;

beforeAll(() => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

afterAll(() => {
  if (originalUrl) process.env.UPSTASH_REDIS_REST_URL = originalUrl;
  if (originalToken) process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
});

describe('InMemoryRatelimit (fallback when Redis not configured)', () => {
  it('should allow requests under the limit', async () => {
    const { billCreateLimiter } = await import('@/lib/ratelimit');
    const result = await billCreateLimiter.limit('user-1');
    expect(result.success).toBe(true);
  });

  it('should block requests that exceed the limit', async () => {
    // billCreate limit is 10/min — exhaust it with a unique identifier
    const { billCreateLimiter } = await import('@/lib/ratelimit');
    const id = `burst-test-${Date.now()}`;

    const results = await Promise.all(
      Array.from({ length: 11 }, () => billCreateLimiter.limit(id))
    );

    const blocked = results.filter(r => !r.success);
    expect(blocked.length).toBeGreaterThanOrEqual(1);
  });

  it('should track remaining count correctly', async () => {
    const { signUpLimiter } = await import('@/lib/ratelimit');
    const id = `remaining-test-${Date.now()}`;

    const first = await signUpLimiter.limit(id);
    expect(first.success).toBe(true);
    expect(first.remaining).toBe(first.limit - 1);
  });

  it('should use separate windows per identifier', async () => {
    const { forgotPasswordLimiter } = await import('@/lib/ratelimit');

    const r1 = await forgotPasswordLimiter.limit(`fp-test-a-${Date.now()}`);
    const r2 = await forgotPasswordLimiter.limit(`fp-test-b-${Date.now()}`);

    // Both fresh identifiers should succeed
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
  });
});
