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
  // Forgot password: 1 request per email per 5 minutes
  forgotPassword: {
    limiter: Ratelimit.slidingWindow(1, '5 m'),
    name: 'forgot_password',
  },
  // Sign up: 3 requests per IP per 10 minutes
  signUp: {
    limiter: Ratelimit.slidingWindow(3, '10 m'),
    name: 'sign_up',
  },
  // Resend verification: 1 request per email per 2 minutes
  resendVerification: {
    limiter: Ratelimit.slidingWindow(1, '2 m'),
    name: 'resend_verification',
  },
  bugReport: {
    limiter: Ratelimit.slidingWindow(3, '10 m'),
    name: 'bug_report',
  },
  // Telegram link code generation: 5 requests per 10 minutes per user
  telegramLinkCode: {
    limiter: Ratelimit.slidingWindow(5, '10 m'),
    name: 'telegram_link_code',
  },
  // Password change: 5 attempts per 15 minutes per user
  passwordChange: {
    limiter: Ratelimit.slidingWindow(5, '15 m'),
    name: 'password_change',
  },
  // Export reports: 10 requests per minute per user
  exportReport: {
    limiter: Ratelimit.slidingWindow(10, '1 m'),
    name: 'export_report',
  },
  // Project invite: 20 requests per hour per project
  inviteEmail: {
    limiter: Ratelimit.slidingWindow(20, '1 h'),
    name: 'invite_email',
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
export const forgotPasswordLimiter = createRateLimiter(rateLimits.forgotPassword);
export const signUpLimiter = createRateLimiter(rateLimits.signUp);
export const resendVerificationLimiter = createRateLimiter(rateLimits.resendVerification);
export const bugReportLimiter = createRateLimiter(rateLimits.bugReport);
export const telegramLinkCodeLimiter = createRateLimiter(rateLimits.telegramLinkCode);
export const passwordChangeLimiter = createRateLimiter(rateLimits.passwordChange);
export const exportLimiter = createRateLimiter(rateLimits.exportReport);
export const inviteLimiter = createRateLimiter(rateLimits.inviteEmail);
