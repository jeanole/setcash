// ============================================================================
// Rate Limiting Utility
// ============================================================================

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Rate limit configurations
export const rateLimits = {
  // Bill creation: 10 requests per minute per user
  billCreate: {
    limiter: Ratelimit.slidingWindow(10, '1 m'),
    name: 'bill_create',
  },
  // Bill re-analysis: 5 requests per minute per user
  billAnalyse: {
    limiter: Ratelimit.slidingWindow(5, '1 m'),
    name: 'bill_analyse',
  },
} as const;

// Mock rate limiter for local development when Redis is not configured
class MockRatelimit {
  async limit(_identifier: string): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
    // Always allow requests in mock mode
    return {
      success: true,
      limit: 100,
      remaining: 99,
      reset: Date.now() + 60000,
    };
  }
}

// Create rate limiter instances
function createRateLimiter(config: { limiter: ReturnType<typeof Ratelimit.slidingWindow>; name: string }) {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  // Use real Upstash Redis if configured, otherwise use mock for local dev
  if (redisUrl && redisToken) {
    return new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: config.limiter,
      analytics: true,
      prefix: `ratelimit:${config.name}`,
    });
  }

  // Always warn that we're using mock rate limiting — all requests will be allowed
  console.warn('[RateLimit] UPSTASH_REDIS_REST_URL not set — using mock rate limiter. All requests will be allowed.');

  return new MockRatelimit();
}

// Export rate limiter instances
export const billCreateLimiter = createRateLimiter(rateLimits.billCreate);
export const billAnalyseLimiter = createRateLimiter(rateLimits.billAnalyse);
