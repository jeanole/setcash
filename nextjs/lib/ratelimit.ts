// ============================================================================
// Rate Limiting Utility
// ============================================================================

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Rate limit configurations
export const rateLimits = {
  // Bill creation: 10 requests per minute per user
  billCreate: { max: 10, window: '1 m', name: 'bill_create' },
  // Bill re-analysis: 5 requests per minute per user
  billAnalyse: { max: 5, window: '1 m', name: 'bill_analyse' },
  // Forgot password: 1 request per email per 5 minutes
  forgotPassword: { max: 1, window: '5 m', name: 'forgot_password' },
  // Sign up: 3 requests per IP per 10 minutes
  signUp: { max: 3, window: '10 m', name: 'sign_up' },
  // Resend verification: 1 request per email per 2 minutes
  resendVerification: { max: 1, window: '2 m', name: 'resend_verification' },
  bugReport: { max: 3, window: '10 m', name: 'bug_report' },
  // Telegram link code generation: 5 requests per 10 minutes per user
  telegramLinkCode: { max: 5, window: '10 m', name: 'telegram_link_code' },
  // Password change: 5 attempts per 15 minutes per user
  passwordChange: { max: 5, window: '15 m', name: 'password_change' },
  // Export reports: 10 requests per minute per user
  exportReport: { max: 10, window: '1 m', name: 'export_report' },
  // Project invite: 20 requests per hour per project
  inviteEmail: { max: 20, window: '1 h', name: 'invite_email' },
  // Comment creation: 20 requests per minute per user
  commentCreate: { max: 20, window: '1 m', name: 'comment_create' },
  // Visit log: 30 requests per minute per IP (public endpoint, prevents abuse)
  visitLog: { max: 30, window: '1 m', name: 'visit_log' },
  // Tour completion: 5 requests per minute per user
  tourComplete: { max: 5, window: '1 m', name: 'tour_complete' },
} as const;

function parseWindow(window: string): number {
  const [val, unit] = window.split(' ');
  const n = parseInt(val, 10);
  if (unit === 's') return n * 1000;
  if (unit === 'm') return n * 60_000;
  if (unit === 'h') return n * 3_600_000;
  return 60_000;
}

// In-memory sliding window rate limiter — used when Redis is not configured
class InMemoryRatelimit {
  private windows = new Map<string, number[]>();

  constructor(private max: number, private windowMs: number) {
    // Periodically evict identifiers whose hits have all fallen outside the
    // window so the map doesn't grow unbounded for long-running processes.
    // unref() so this timer never keeps the Node process alive on its own.
    const cleanupInterval = setInterval(() => this.cleanup(), this.windowMs);
    cleanupInterval.unref();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [identifier, hits] of this.windows) {
      const active = hits.filter(t => now - t < this.windowMs);
      if (active.length === 0) {
        this.windows.delete(identifier);
      } else if (active.length !== hits.length) {
        this.windows.set(identifier, active);
      }
    }
  }

  async limit(identifier: string): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
    const now = Date.now();
    const hits = (this.windows.get(identifier) ?? []).filter(t => now - t < this.windowMs);

    if (hits.length >= this.max) {
      return { success: false, limit: this.max, remaining: 0, reset: now + this.windowMs };
    }

    hits.push(now);
    this.windows.set(identifier, hits);
    return { success: true, limit: this.max, remaining: this.max - hits.length, reset: now + this.windowMs };
  }
}

// Create rate limiter instances
function createRateLimiter(config: { max: number; window: string; name: string }) {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (redisUrl && redisToken) {
    return new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(config.max, config.window as `${number} ${'s' | 'm' | 'h' | 'd'}`),
      analytics: true,
      prefix: `ratelimit:${config.name}`,
    });
  }

  console.warn('[RateLimit] UPSTASH_REDIS_REST_URL not set — using in-memory rate limiter.');

  return new InMemoryRatelimit(config.max, parseWindow(config.window));
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
export const commentCreateLimiter = createRateLimiter(rateLimits.commentCreate);
export const visitLogLimiter = createRateLimiter(rateLimits.visitLog);
export const tourCompleteLimiter = createRateLimiter(rateLimits.tourComplete);
