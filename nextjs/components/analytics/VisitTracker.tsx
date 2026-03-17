'use client';

import { useEffect } from 'react';

/**
 * Fire-and-forget visit tracking pixel.
 * Renders nothing — mounts once and sends POST /api/analytics/visit.
 */
export default function VisitTracker() {
  useEffect(() => {
    fetch('/api/analytics/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => {});
  }, []);

  return null;
}
