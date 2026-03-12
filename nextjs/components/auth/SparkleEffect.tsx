'use client';

import { useEffect } from 'react';

const SPARKLE_COLORS = [
  '#ff006e',
  '#fb5607',
  '#ffbe0b',
  '#06d6a0',
  '#3a86ff',
  '#8338ec',
  '#ff1493',
  '#00ffcc',
];

export default function SparkleEffect() {
  useEffect(() => {
    function spawnSparkle() {
      const el = document.createElement('div');
      el.className = 'landing-sparkle';
      const size = 4 + Math.random() * 8;
      const color = SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)];
      const duration = 0.8 + Math.random() * 1.2;
      el.style.cssText = [
        `width:${size}px`,
        `height:${size}px`,
        `background:${color}`,
        `left:${Math.random() * 100}vw`,
        `bottom:${Math.random() * 20}px`,
        `box-shadow:0 0 ${size * 2}px ${color}`,
        `animation-duration:${duration}s`,
      ].join(';');
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 2000);
    }

    const interval = setInterval(spawnSparkle, 150);
    return () => clearInterval(interval);
  }, []);

  return null;
}
