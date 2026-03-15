'use client';

import { useState, useCallback } from 'react';

interface CinematicButtonProps {
  children: React.ReactNode;
  probability?: number;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  dx: string;
  dy: string;
  color: string;
  size: number;
}

const PARTICLE_COLORS = ['var(--accent)', '#F59E0B', '#F43F5E', '#10B981'];

export default function CinematicButton({
  children,
  probability = 0.25,
}: CinematicButtonProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isBurstActive, setIsBurstActive] = useState(false);

  const handleClickCapture = useCallback(
    (e: React.MouseEvent<HTMLSpanElement>) => {
      // Check prefers-reduced-motion
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReduced) return;

      // Debounce: skip if burst already active
      if (isBurstActive) return;

      // Probability roll
      if (Math.random() >= probability) return;

      setIsBurstActive(true);

      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const count = Math.floor(Math.random() * 5) + 12; // 12-16 particles
      const newParticles: Particle[] = Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * 2 * Math.PI + Math.random() * 0.5;
        const radius = Math.random() * 80; // cap at 80px
        const dx = Math.cos(angle) * radius;
        const dy = Math.sin(angle) * radius;
        return {
          id: Date.now() + i,
          x,
          y,
          dx: `${dx}px`,
          dy: `${dy}px`,
          color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
          size: Math.floor(Math.random() * 4) + 4, // 4-8px
        };
      });

      setParticles(newParticles);

      setTimeout(() => {
        setParticles([]);
        setIsBurstActive(false);
      }, 600);
    },
    [isBurstActive, probability]
  );

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex' }}
      onClickCapture={handleClickCapture}
    >
      {children}
      {particles.map((p) => (
        <span
          key={p.id}
          aria-hidden="true"
          role="presentation"
          style={{
            position: 'absolute',
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            backgroundColor: p.color,
            pointerEvents: 'none',
            transform: 'translate(-50%, -50%)',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ['--dx' as any]: p.dx,
            ['--dy' as any]: p.dy,
            animation: 'particle-burst 600ms ease-out forwards',
          }}
        />
      ))}
    </span>
  );
}
