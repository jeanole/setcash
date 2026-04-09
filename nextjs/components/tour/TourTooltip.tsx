'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import type { TourStep } from '@/lib/tour/steps';

interface TourTooltipProps {
  step: TourStep;
  currentStep: number;
  stepCount: number;
  position: { top: number; left: number };
  placement: TourStep['placement'];
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onComplete: () => void;
  tooltipRef: React.RefObject<HTMLDivElement | null>;
}

function ArrowIndicator({ placement }: { placement: TourStep['placement'] }) {
  const base = 'absolute w-3 h-3 bg-[var(--vb-card-bg)] dark:bg-[var(--bg-surface)] rotate-45';

  switch (placement) {
    case 'bottom':
      return (
        <div
          className={cn(base, 'border-t border-l border-[var(--vb-card-border)] dark:border-[var(--border)]')}
          style={{ top: -6, left: '50%', transform: 'translateX(-50%) rotate(45deg)' }}
        />
      );
    case 'top':
      return (
        <div
          className={cn(base, 'border-b border-r border-[var(--vb-card-border)] dark:border-[var(--border)]')}
          style={{ bottom: -6, left: '50%', transform: 'translateX(-50%) rotate(45deg)' }}
        />
      );
    case 'left':
      return (
        <div
          className={cn(base, 'border-t border-r border-[var(--vb-card-border)] dark:border-[var(--border)]')}
          style={{ right: -6, top: '50%', transform: 'translateY(-50%) rotate(45deg)' }}
        />
      );
    case 'right':
      return (
        <div
          className={cn(base, 'border-b border-l border-[var(--vb-card-border)] dark:border-[var(--border)]')}
          style={{ left: -6, top: '50%', transform: 'translateY(-50%) rotate(45deg)' }}
        />
      );
  }
}

export default function TourTooltip({
  step,
  currentStep,
  stepCount,
  position,
  placement,
  onNext,
  onBack,
  onSkip,
  onComplete,
  tooltipRef,
}: TourTooltipProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === stepCount - 1;

  return createPortal(
    <div
      ref={tooltipRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-tooltip-title"
      aria-describedby="tour-tooltip-body"
      tabIndex={-1}
      className="rounded-xl shadow-md border border-[var(--vb-card-border)] bg-[var(--vb-card-bg)] dark:bg-[var(--bg-surface)] dark:border-[var(--border)] animate-[scaleIn_0.15s_ease-out]"
      style={{
        position: 'fixed',
        zIndex: 101,
        top: position.top,
        left: position.left,
        maxWidth: 340,
        minWidth: 280,
      }}
    >
      {/* Directional arrow */}
      <ArrowIndicator placement={placement} />

      {/* Content */}
      <div className="p-4">
        <h3
          id="tour-tooltip-title"
          className="text-sm font-semibold text-[var(--vb-text-primary)] dark:text-[var(--text-primary)]"
        >
          {step.title}
        </h3>
        <p
          id="tour-tooltip-body"
          className="mt-1 text-sm text-[var(--vb-text-secondary)] dark:text-[var(--text-secondary)]"
        >
          {step.body}
        </p>
      </div>

      {/* Navigation bar */}
      <div className="flex items-center justify-between px-4 pt-2 pb-3 border-t border-[var(--vb-card-border)] dark:border-[var(--border)]">
        {/* Left: Skip */}
        <button
          onClick={onSkip}
          className="text-sm font-semibold text-[var(--vb-text-muted)] hover:underline"
        >
          Skip tour
        </button>

        {/* Center: Step dots */}
        <div
          className="flex items-center gap-2"
          aria-label={`Step ${currentStep + 1} of ${stepCount}`}
        >
          {Array.from({ length: stepCount }, (_, i) => (
            <span
              key={i}
              className={cn(
                'w-2 h-2 rounded-full',
                i === currentStep
                  ? 'bg-[var(--vb-accent)]'
                  : 'bg-slate-200 dark:bg-[var(--border)]'
              )}
            />
          ))}
        </div>

        {/* Right: Back + Next/Done */}
        <div className="flex items-center gap-2">
          {!isFirstStep && (
            <button
              onClick={onBack}
              className="px-4 py-2 text-sm font-semibold rounded-lg border border-[var(--vb-card-border)] dark:border-[var(--border)] bg-transparent hover:bg-slate-50 dark:hover:bg-zinc-800"
            >
              Back
            </button>
          )}
          {isLastStep ? (
            <button
              onClick={onComplete}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--vb-accent)] hover:bg-[var(--vb-accent-hover)] text-[#1e293b]"
            >
              Done
            </button>
          ) : (
            <button
              onClick={onNext}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--vb-accent)] hover:bg-[var(--vb-accent-hover)] text-[#1e293b]"
            >
              Next
            </button>
          )}
        </div>
      </div>

      {/* Screen reader live region */}
      <div aria-live="polite" className="sr-only">
        Tour step {currentStep + 1} of {stepCount}: {step.title}. {step.body}
      </div>
    </div>,
    document.body
  );
}
