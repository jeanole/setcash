"use strict";
// ============================================================================
// Rate Limiting Utility
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.billAnalyseLimiter = exports.billCreateLimiter = exports.rateLimits = void 0;
const ratelimit_1 = require("@upstash/ratelimit");
const redis_1 = require("@upstash/redis");
// Rate limit configurations
exports.rateLimits = {
    // Bill creation: 10 requests per minute per user
    billCreate: {
        limiter: ratelimit_1.Ratelimit.slidingWindow(10, '1 m'),
        name: 'bill_create',
    },
    // Bill re-analysis: 5 requests per minute per user
    billAnalyse: {
        limiter: ratelimit_1.Ratelimit.slidingWindow(5, '1 m'),
        name: 'bill_analyse',
    },
};
// Mock rate limiter for local development when Redis is not configured
class MockRatelimit {
    async limit(_identifier) {
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
function createRateLimiter(config) {
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    // Use real Upstash Redis if configured, otherwise use mock for local dev
    if (redisUrl && redisToken) {
        return new ratelimit_1.Ratelimit({
            redis: redis_1.Redis.fromEnv(),
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
exports.billCreateLimiter = createRateLimiter(exports.rateLimits.billCreate);
exports.billAnalyseLimiter = createRateLimiter(exports.rateLimits.billAnalyse);
