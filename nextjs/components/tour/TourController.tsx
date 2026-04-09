'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTour } from '@/components/providers/TourProvider';
import { TOUR_STEPS } from '@/lib/tour/steps';
import type { TourStep } from '@/lib/tour/steps';
import TourOverlay from './TourOverlay';
import TourTooltip from './TourTooltip';

// ---------------------------------------------------------------------------
// Position computation
// ---------------------------------------------------------------------------

const GAP = 12;
const MARGIN = 16;

function computePosition(
  targetRect: DOMRect,
  tooltipEl: HTMLDivElement,
  placement: TourStep['placement'],
): { top: number; left: number } {
  const tw = tooltipEl.offsetWidth;
  const th = tooltipEl.offsetHeight;

  let top: number;
  let left: number;

  switch (placement) {
    case 'bottom':
      top = targetRect.bottom + GAP;
      left = targetRect.left + targetRect.width / 2 - tw / 2;
      break;
    case 'top':
      top = targetRect.top - th - GAP;
      left = targetRect.left + targetRect.width / 2 - tw / 2;
      break;
    case 'right':
      top = targetRect.top + targetRect.height / 2 - th / 2;
      left = targetRect.right + GAP;
      break;
    case 'left':
      top = targetRect.top + targetRect.height / 2 - th / 2;
      left = targetRect.left - tw - GAP;
      break;
  }

  // Viewport clamping (16px margin from edges)
  left = Math.max(MARGIN, Math.min(left, window.innerWidth - tw - MARGIN));
  top = Math.max(MARGIN, Math.min(top, window.innerHeight - th - MARGIN));

  return { top, left };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isInViewport(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= window.innerHeight &&
    rect.right <= window.innerWidth
  );
}

// ---------------------------------------------------------------------------
// TourController
// ---------------------------------------------------------------------------

export default function TourController() {
  const { isActive, currentStep, stepCount, next, back, skip, complete } = useTour();

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Track previous target selector for aria-describedby cleanup
  const prevSelectorRef = useRef<string | null>(null);
  // Guard stale setState calls from scroll delay
  const mountedRef = useRef(true);

  const step = TOUR_STEPS[currentStep];

  // Cleanup mounted ref on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Target location and positioning
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isActive) return;

    // Clean up aria-describedby on previous target
    if (prevSelectorRef.current) {
      const prevTarget = document.querySelector(prevSelectorRef.current);
      if (prevTarget) {
        prevTarget.removeAttribute('aria-describedby');
      }
    }

    const targetEl = document.querySelector(step.targetSelector);

    if (!targetEl) {
      console.warn('Tour target not found: ' + step.targetSelector + '. Showing tooltip centered.');
      setTargetRect(null);
      setTooltipPosition({
        top: window.innerHeight / 2 - 100,
        left: window.innerWidth / 2 - 170,
      });
      prevSelectorRef.current = null;
      return;
    }

    // Set aria-describedby on target element (D-14)
    targetEl.setAttribute('aria-describedby', 'tour-tooltip-body');
    prevSelectorRef.current = step.targetSelector;

    // Auto-scroll if target is off-screen (D-07)
    let scrollTimeout: ReturnType<typeof setTimeout> | null = null;

    const measureAndSet = () => {
      if (!mountedRef.current) return;
      const rect = targetEl.getBoundingClientRect();
      setTargetRect(rect);
    };

    if (!isInViewport(targetEl)) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Wait 300ms for scroll to settle before measuring
      scrollTimeout = setTimeout(measureAndSet, 300);
    } else {
      measureAndSet();
    }

    return () => {
      if (scrollTimeout) clearTimeout(scrollTimeout);
    };
  }, [isActive, currentStep, step]);

  // ---------------------------------------------------------------------------
  // Tooltip positioning (runs after targetRect changes and tooltip has rendered)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isActive) return;
    if (targetRect === null) return; // centered fallback already set

    const rafId = requestAnimationFrame(() => {
      if (!tooltipRef.current || !mountedRef.current) return;
      const pos = computePosition(targetRect, tooltipRef.current, step.placement);
      setTooltipPosition(pos);
    });

    return () => cancelAnimationFrame(rafId);
  }, [targetRect, isActive, step]);

  // ---------------------------------------------------------------------------
  // Resize handler (debounced 100ms) — mitigates T-07-06
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isActive) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const handleResize = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (!mountedRef.current) return;
        const targetEl = document.querySelector(step.targetSelector);
        if (targetEl) {
          const rect = targetEl.getBoundingClientRect();
          setTargetRect(rect);
        } else {
          setTargetRect(null);
          setTooltipPosition({
            top: window.innerHeight / 2 - 100,
            left: window.innerWidth / 2 - 170,
          });
        }
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [isActive, currentStep, step]);

  // ---------------------------------------------------------------------------
  // Keyboard handler (Escape, ArrowRight, ArrowLeft, Tab focus trap)
  // ---------------------------------------------------------------------------
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        skip();
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (currentStep < stepCount - 1) next();
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentStep > 0) back();
        return;
      }
      if (e.key === 'Tab') {
        const focusable = tooltipRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [currentStep, stepCount, next, back, skip],
  );

  useEffect(() => {
    if (!isActive) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, handleKeyDown]);

  // ---------------------------------------------------------------------------
  // Focus management — move focus to tooltip on mount and step change
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isActive) return;

    const rafId = requestAnimationFrame(() => {
      if (tooltipRef.current) {
        tooltipRef.current.focus();
      }
    });

    return () => cancelAnimationFrame(rafId);
  }, [isActive, currentStep]);

  // ---------------------------------------------------------------------------
  // Cleanup aria-describedby on tour end
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isActive && prevSelectorRef.current) {
      const prevTarget = document.querySelector(prevSelectorRef.current);
      if (prevTarget) {
        prevTarget.removeAttribute('aria-describedby');
      }
      prevSelectorRef.current = null;
    }
  }, [isActive]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (!isActive) return null;

  return (
    <>
      <TourOverlay targetRect={targetRect} />
      <TourTooltip
        step={step}
        currentStep={currentStep}
        stepCount={stepCount}
        position={tooltipPosition}
        placement={step.placement}
        onNext={next}
        onBack={back}
        onSkip={skip}
        onComplete={complete}
        tooltipRef={tooltipRef}
      />
    </>
  );
}
