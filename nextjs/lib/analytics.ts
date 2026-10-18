// ============================================================================
// Analytics Utilities — UA classification, browser/OS parsing & geo extraction
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
 * Parse the browser name from a User-Agent string.
 */
export function parseBrowser(userAgent: string | null): string | null {
  if (!userAgent) return null;
  const ua = userAgent;

  // Order matters — check specific browsers before generic engine names
  if (/Edg(e|A)?\//.test(ua)) return 'Edge';
  if (/OPR\/|Opera/.test(ua)) return 'Opera';
  if (/SamsungBrowser\//.test(ua)) return 'Samsung Internet';
  if (/UCBrowser\//.test(ua)) return 'UC Browser';
  if (/Brave/.test(ua)) return 'Brave';
  if (/Vivaldi\//.test(ua)) return 'Vivaldi';
  if (/YaBrowser\//.test(ua)) return 'Yandex';
  if (/Firefox\//.test(ua) && !/Seamonkey\//.test(ua)) return 'Firefox';
  if (/Chrome\//.test(ua) && !/Chromium\//.test(ua)) return 'Chrome';
  if (/Chromium\//.test(ua)) return 'Chromium';
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'Safari';
  if (/MSIE|Trident/.test(ua)) return 'Internet Explorer';
  return null;
}

/**
 * Parse the OS from a User-Agent string.
 */
export function parseOS(userAgent: string | null): string | null {
  if (!userAgent) return null;
  const ua = userAgent;

  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/Mac OS X|Macintosh/.test(ua)) return 'macOS';
  if (/Android/.test(ua)) return 'Android';
  if (/CrOS/.test(ua)) return 'ChromeOS';
  if (/Linux/.test(ua)) return 'Linux';
  if (/Windows/.test(ua)) return 'Windows';
  return null;
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

// Global write cap for the public analytics endpoints. Per-IP limits alone
// let an attacker with many source addresses insert unbounded rows, so every
// accepted request also counts against this single process-wide window.
const ANALYTICS_GLOBAL_MAX_PER_MINUTE = 600;
const ANALYTICS_GLOBAL_WINDOW_MS = 60_000;
let analyticsWindowStart = 0;
let analyticsWindowCount = 0;

/**
 * Fixed-window global cap shared by /api/analytics/visit and /event.
 * Returns false when the cap for the current minute is exhausted.
 * Per-process (not shared across instances), which still bounds inserts.
 */
export function allowAnalyticsWrite(): boolean {
  const now = Date.now();
  if (now - analyticsWindowStart >= ANALYTICS_GLOBAL_WINDOW_MS) {
    analyticsWindowStart = now;
    analyticsWindowCount = 0;
  }
  if (analyticsWindowCount >= ANALYTICS_GLOBAL_MAX_PER_MINUTE) return false;
  analyticsWindowCount += 1;
  return true;
}
