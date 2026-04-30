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

// Session-scoped dismissal persistence — survives TourProvider remounts within
// the same browser tab session, but clears on tab close so demo users still
// get the tour on their next login per Phase 8 D-12.
//
// Production-confirmed (2026-04-30): TourProvider remounts when navigating
// /dashboard → /budget (the /budget segment has a loading.tsx Suspense boundary
// that causes the parent provider tree to remount in React 18 streaming mode).
// A useRef alone resets on remount, allowing the auto-start effect to see
// dismissedRef=false again and reactivate the tour. sessionStorage survives
// the remount and gates the effect correctly.
const SESSION_DISMISS_KEY_PREFIX = 'tour-dismissed:';

function readSessionDismiss(userId: string | undefined): boolean {
  if (!userId) return false;
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(SESSION_DISMISS_KEY_PREFIX + userId) === '1';
  } catch {
    // sessionStorage may throw in private mode or with strict cookie policies
    return false;
  }
}

function writeSessionDismiss(userId: string | undefined): void {
  if (!userId) return;
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(SESSION_DISMISS_KEY_PREFIX + userId, '1');
  } catch {
    // ignore — ref still mirrors the value in-memory for this mount
  }
}

export default function TourProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const pathname = usePathname();
  const router = useRouter();
  const hasPushedRef = useRef(false);
  const autoStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // In-memory mirror of the sessionStorage dismissal flag. Hydrated on mount
  // (and on session change, in case userId becomes available after mount).
  // Always read in tandem with sessionStorage to survive provider remounts.
  const dismissedThisSessionRef = useRef(false);

  const userId = session?.user?.id as string | undefined;

  // Hydrate the in-memory ref from sessionStorage. Runs on mount and whenever
  // userId becomes available. Cheap idempotent read.
  useEffect(() => {
    if (!userId) return;
    if (readSessionDismiss(userId)) {
      dismissedThisSessionRef.current = true;
    }
  }, [userId]);

  // Auto-start gating — Phase 8 D-11:
  //   status === 'authenticated'
  //   AND (isDemoAccount OR !hasSeenTour)    (Phase 6 D-03)
  //   AND pathname === '/dashboard'           (D-05)
  // If pathname is not /dashboard, trigger a one-shot router.push('/dashboard') (D-07),
  // then wait for the effect to re-run after the route change.
  // On match, wait ~150ms for the dashboard to paint before setIsActive(true) (D-11).
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user) return;

    // Cross-mount dismissal gate — checks both the in-memory ref and
    // sessionStorage so a fresh provider remount does not bypass dismissal.
    if (dismissedThisSessionRef.current || readSessionDismiss(userId)) {
      dismissedThisSessionRef.current = true;
      return;
    }

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
  }, [status, session, pathname, router, isActive, userId]);

  const stepCount = TOUR_STEPS.length;

  const next = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, stepCount - 1));
  }, [stepCount]);

  const back = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  // Per D-12: set isActive = false locally; no forced JWT refresh.
  // completeTour() fires and forgets — JWT catches up on next natural refresh.
  // Persist the dismissal in sessionStorage so it survives TourProvider
  // remounts within the same tab session (see SESSION_DISMISS_KEY_PREFIX above).
  const handleComplete = useCallback(() => {
    dismissedThisSessionRef.current = true;
    writeSessionDismiss(userId);
    setIsActive(false);
    setCurrentStep(0);
    completeTour().catch((err) => {
      console.error('Error completing tour:', err);
    });
  }, [userId]);

  const skip = useCallback(() => {
    handleComplete();
  }, [handleComplete]);

  // Abort tour WITHOUT marking hasSeenTour — used when every step skips for
  // missing targets (Phase 8 D-10). Unlike skip() / handleComplete(), this
  // does NOT call /api/tour/complete, so the user gets another chance on
  // next login. Still session-scoped dismissed so it does not loop within
  // the current tab.
  const abort = useCallback(() => {
    dismissedThisSessionRef.current = true;
    writeSessionDismiss(userId);
    setIsActive(false);
    setCurrentStep(0);
    hasPushedRef.current = false;
  }, [userId]);

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
