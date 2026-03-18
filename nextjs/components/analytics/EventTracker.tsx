'use client';

import { useEffect, useRef } from 'react';

interface EventTrackerProps {
  /** Mark events as authenticated (default: false) */
  isAuthenticated?: boolean;
}

function sendEvent(
  eventType: string,
  eventLabel?: string,
  isAuthenticated = false
) {
  fetch('/api/analytics/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: window.location.pathname,
      eventType,
      eventLabel: eventLabel ?? null,
      isAuthenticated,
    }),
  }).catch(() => {});
}

/**
 * Tracks scroll depth milestones and time-on-page.
 * Renders nothing. Add once per page/layout.
 *
 * - Fires scroll_depth events at 25 / 50 / 75 / 100 %
 * - Fires time_on_page on page unload (via sendBeacon for reliability)
 */
export default function EventTracker({ isAuthenticated = false }: EventTrackerProps) {
  const startTimeRef = useRef(Date.now());
  const milestones = useRef(new Set<number>());
  const auth = useRef(isAuthenticated);
  auth.current = isAuthenticated;

  // Scroll depth
  useEffect(() => {
    function handleScroll() {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      const pct = Math.round((window.scrollY / scrollable) * 100);
      for (const milestone of [25, 50, 75, 100]) {
        if (pct >= milestone && !milestones.current.has(milestone)) {
          milestones.current.add(milestone);
          sendEvent('scroll_depth', `${milestone}%`, auth.current);
        }
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Time on page — use sendBeacon so it fires reliably on navigation/close
  useEffect(() => {
    function handleUnload() {
      const seconds = Math.round((Date.now() - startTimeRef.current) / 1000);
      if (seconds < 3) return; // ignore accidental hits

      const payload = JSON.stringify({
        path: window.location.pathname,
        eventType: 'time_on_page',
        eventLabel: `${seconds}s`,
        isAuthenticated: auth.current,
      });

      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon('/api/analytics/event', blob);
      }
    }

    window.addEventListener('pagehide', handleUnload);
    return () => window.removeEventListener('pagehide', handleUnload);
  }, []);

  return null;
}

/**
 * Call this from a button's onClick handler to track CTA clicks.
 */
export function trackCta(label: string, isAuthenticated = false) {
  sendEvent('cta_click', label, isAuthenticated);
}
