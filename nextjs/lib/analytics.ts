// ============================================================================
// Analytics Utilities — UA classification & country code extraction
// ============================================================================

import { NextRequest } from 'next/server';

/**
 * Classify a User-Agent string into 'mobile', 'desktop', or 'bot'.
 * Uses simple regex checks — no external packages required.
 */
export function classifyUA(userAgent: string | null): 'mobile' | 'desktop' | 'bot' {
  if (!userAgent) return 'desktop';

  const ua = userAgent.toLowerCase();

  // Check for bots first (broad set of common bot indicators)
  if (
    /bot|crawler|spider|crawling|facebookexternalhit|googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|sogou|exabot|ia_archiver|semrush|ahrefsbot|dotbot|rogerbot|uptimerobot|pingdom|statuspage|lighthouse|headlesschrome/i.test(ua)
  ) {
    return 'bot';
  }

  // Check for mobile devices
  if (/mobile|android|iphone|ipad|ipod|blackberry|windows phone|opera mini|iemobile/i.test(ua)) {
    return 'mobile';
  }

  return 'desktop';
}

/**
 * Extract the 2-letter ISO country code from the CF-IPCountry Cloudflare header.
 * Returns null if not present or not a valid 2-letter code.
 */
export function getCountryCode(req: NextRequest): string | null {
  const code = req.headers.get('cf-ipcountry');
  if (!code || code.length !== 2 || code === 'XX') return null;
  return code.toUpperCase();
}

/**
 * Extract the client IP address for rate limiting purposes.
 * Prefers x-forwarded-for, falls back to x-real-ip.
 */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    // x-forwarded-for may contain a comma-separated list; take the first
    return forwarded.split(',')[0].trim();
  }
  return req.headers.get('x-real-ip') ?? 'unknown';
}
