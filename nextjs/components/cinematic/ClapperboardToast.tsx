'use client';

import { useEffect } from 'react';

interface ClapperboardToastProps {
  show: boolean;
  onComplete: () => void;
}

export default function ClapperboardToast({ show, onComplete }: ClapperboardToastProps) {
  useEffect(() => {
    if (!show) return;

    // Check prefers-reduced-motion
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      onComplete();
      return;
    }

    const timer = setTimeout(() => {
      onComplete();
    }, 1200);

    return () => clearTimeout(timer);
  }, [show, onComplete]);

  if (!show) return null;

  return (
    <div
      aria-hidden="true"
      role="presentation"
      style={{
        position: 'fixed',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9000,
        pointerEvents: 'none',
        animation: 'clapper-entry 1200ms ease-in-out forwards',
        maxWidth: '280px',
        width: '100%',
      }}
    >
      <svg
        width="200"
        height="160"
        viewBox="0 0 200 160"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Clapperboard body */}
        <rect x="10" y="50" width="180" height="105" rx="6" fill="#18181B" />

        {/* Text on body */}
        <text
          x="100"
          y="115"
          textAnchor="middle"
          fill="#FAFAFA"
          fontFamily="var(--font-dm-mono), monospace"
          fontSize="28"
          fontWeight="500"
          letterSpacing="1"
        >
          Action!
        </text>

        {/* Clapper arm (striped top part that snaps shut) */}
        <g
          style={{
            transformOrigin: '10px 50px',
            animation: 'clapper-arm 200ms ease-in forwards',
            animationDelay: '300ms',
          }}
        >
          <rect x="10" y="20" width="180" height="34" rx="4" fill="#27272A" />
          {/* Stripes on clapper arm */}
          <rect x="10" y="20" width="30" height="34" fill="#FAFAFA" opacity="0.9" />
          <rect x="55" y="20" width="30" height="34" fill="#FAFAFA" opacity="0.9" />
          <rect x="100" y="20" width="30" height="34" fill="#FAFAFA" opacity="0.9" />
          <rect x="145" y="20" width="30" height="34" rx="0 4 4 0" fill="#FAFAFA" opacity="0.9" />
          {/* Arm border */}
          <rect x="10" y="20" width="180" height="34" rx="4" fill="none" stroke="#3F3F46" strokeWidth="1" />
        </g>
      </svg>
    </div>
  );
}
