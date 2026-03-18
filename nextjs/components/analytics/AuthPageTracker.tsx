'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import EventTracker, { trackCta } from './EventTracker';

export { trackCta };

/**
 * Drop into the authenticated layout to track:
 *  - page_view events on every route change
 *  - scroll depth + time-on-page (via EventTracker)
 */
export default function AuthPageTracker() {
  const pathname = usePathname();
  const didTrackRef = useRef<string | null>(null);

  useEffect(() => {
    if (didTrackRef.current === pathname) return;
    didTrackRef.current = pathname;

    fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: pathname,
        eventType: 'page_view',
        isAuthenticated: true,
      }),
    }).catch(() => {});
  }, [pathname]);

  return <EventTracker isAuthenticated />;
}
