'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TourOverlayProps {
  targetRect: DOMRect | null;
}

const PADDING = 8;

export default function TourOverlay({ targetRect }: TourOverlayProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const hasCutout = targetRect !== null;
  const cutoutX = hasCutout ? targetRect.x - PADDING : 0;
  const cutoutY = hasCutout ? targetRect.y - PADDING : 0;
  const cutoutW = hasCutout ? targetRect.width + PADDING * 2 : 0;
  const cutoutH = hasCutout ? targetRect.height + PADDING * 2 : 0;

  return createPortal(
    <svg
      className="fixed inset-0 w-full h-full"
      style={{ zIndex: 100, pointerEvents: 'none' }}
      aria-hidden="true"
    >
      <defs>
        <mask id="tour-spotlight-mask">
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          {hasCutout && (
            <rect
              fill="black"
              rx="8"
              ry="8"
              style={{
                x: cutoutX,
                y: cutoutY,
                width: cutoutW,
                height: cutoutH,
                transition: 'x 200ms ease, y 200ms ease, width 200ms ease, height 200ms ease',
              }}
            />
          )}
        </mask>
      </defs>
      <rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        fill="rgba(0, 0, 0, 0.5)"
        mask="url(#tour-spotlight-mask)"
        style={{ pointerEvents: 'all' }}
      />
    </svg>,
    document.body,
  );
}
