'use client';

import { useEffect, useRef, useState, Children } from 'react';

interface FilmRollNavProps {
  children: React.ReactNode;
}

export default function FilmRollNav({ children }: FilmRollNavProps) {
  const isFilmRollMode = useRef(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Check prefers-reduced-motion
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!prefersReduced) {
      isFilmRollMode.current = Math.random() < 0.2;
    }
    setMounted(true);
  }, []);

  if (!mounted || !isFilmRollMode.current) {
    // Normal rendering without film-roll animation
    return <>{children}</>;
  }

  // Film-roll mode: wrap each child with staggered animation
  return (
    <>
      {Children.map(children, (child, index) => (
        <div
          key={index}
          style={{
            opacity: 0,
            animation: `film-tick 120ms ease-out forwards`,
            animationDelay: `${index * 80}ms`,
          }}
        >
          {child}
        </div>
      ))}
    </>
  );
}
