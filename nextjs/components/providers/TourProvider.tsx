'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { TOUR_STEPS } from '@/lib/tour/steps';
import { completeTour } from '@/lib/api/tour';

interface TourContextValue {
  isActive: boolean;
  currentStep: number;
  stepCount: number;
  next: () => void;
  back: () => void;
  skip: () => void;
  complete: () => void;
  abort: () => void;
}

const TourContext = createContext<TourContextValue | null>(null);

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used within TourProvider');
  return ctx;
}

export default function TourProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const pathname = usePathname();
  const router = useRouter();
  const hasPushedRef = useRef(false);
  const autoStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-start gating — Phase 8 D-11:
  //   status === 'authenticated'
  //   AND (isDemoAccount OR !hasSeenTour)    (Phase 6 D-03)
  //   AND pathname === '/dashboard'           (D-05)
  // If pathname is not /dashboard, trigger a one-shot router.push('/dashboard') (D-07),
  // then wait for the effect to re-run after the route change.
  // On match, wait ~150ms for the dashboard to paint before setIsActive(true) (D-11).
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user) return;

    const user = session.user as { hasSeenTour?: boolean; isDemoAccount?: boolean };
    const isDemoAccount = user.isDemoAccount ?? false;
    const hasSeenTour = user.hasSeenTour ?? false;

    // Eligibility check — D-12: demo users bypass hasSeenTour
    const eligible = isDemoAccount || !hasSeenTour;
    if (!eligible) return;

    // Already active — do not re-trigger
    if (isActive) return;

    // Pathname gate — D-05/D-07
    if (pathname !== '/dashboard') {
      // One-shot push to /dashboard; effect re-runs after navigation
      if (!hasPushedRef.current) {
        hasPushedRef.current = true;
        router.push('/dashboard');
      }
      return;
    }

    // Settle delay — D-11: let the dashboard paint before activating
    if (autoStartTimerRef.current) clearTimeout(autoStartTimerRef.current);
    autoStartTimerRef.current = setTimeout(() => {
      setIsActive(true);
      setCurrentStep(0);
      autoStartTimerRef.current = null;
    }, 150);

    return () => {
      if (autoStartTimerRef.current) {
        clearTimeout(autoStartTimerRef.current);
        autoStartTimerRef.current = null;
      }
    };
  }, [status, session, pathname, router, isActive]);

  const stepCount = TOUR_STEPS.length;

  const next = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, stepCount - 1));
  }, [stepCount]);

  const back = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  // Per D-12: set isActive = false locally; no forced JWT refresh
  // completeTour() fires and forgets — JWT catches up on next natural refresh
  const handleComplete = useCallback(() => {
    setIsActive(false);
    setCurrentStep(0);
    completeTour().catch((err) => {
      console.error('Error completing tour:', err);
    });
  }, []);

  const skip = useCallback(() => {
    handleComplete();
  }, [handleComplete]);

  // Abort tour WITHOUT marking hasSeenTour — used when every step skips for
  // missing targets (Phase 8 D-10). Unlike skip() / handleComplete(), this
  // does NOT call /api/tour/complete, so the user gets another chance on
  // next login.
  const abort = useCallback(() => {
    setIsActive(false);
    setCurrentStep(0);
    hasPushedRef.current = false;
  }, []);

  const value: TourContextValue = {
    isActive,
    currentStep,
    stepCount,
    next,
    back,
    skip,
    complete: handleComplete,
    abort,
  };

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}
