'use client';

import { useEffect } from 'react';
import { getSessionId } from '@/lib/sessionId';

/**
 * Fire-and-forget visit tracking pixel.
 * Renders nothing — mounts once and sends POST /api/analytics/visit
 * including referrer domain, UTM parameters, screen size, and language.
 */
export default function VisitTracker() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Extract referrer domain only (no path/query to avoid PII)
    let referrer: string | null = null;
    if (document.referrer) {
      try {
        referrer = new URL(document.referrer).hostname;
      } catch {
        // ignore malformed referrer
      }
    }

    fetch('/api/analytics/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path:         window.location.pathname,
        referrer:     referrer ?? undefined,
        utmSource:    params.get('utm_source') ?? undefined,
        utmMedium:    params.get('utm_medium') ?? undefined,
        utmCampaign:  params.get('utm_campaign') ?? undefined,
        screenWidth:  window.screen.width,
        screenHeight: window.screen.height,
        language:     navigator.language ?? undefined,
        sessionId:    getSessionId(),
      }),
    }).catch(() => {});
  }, []);

  return null;
}
