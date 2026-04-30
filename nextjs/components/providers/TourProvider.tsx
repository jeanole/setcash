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

// DIAGNOSTIC (tour-restart-skip-broken): module-scope counter increments on
// every TourProvider mount within a page-load. If we ever see >1 here, the
// provider is being remounted and the per-instance dismissed ref cannot save
// us. Remove this and the [tour-debug] logs once the bug is closed.
let __tourProviderMountCount = 0;

export default function TourProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const pathname = usePathname();
  const router = useRouter();
  const hasPushedRef = useRef(false);
  const autoStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Gates auto-start after the user dismisses the tour. completeTour() writes
  // hasSeenTour=true to the DB but the NextAuth JWT stays stale until a natural
  // refresh, so without this ref the effect would see eligible=true and
  // reactivate the tour ~150ms after Skip/Done. Also covers demo accounts,
  // which ignore hasSeenTour. Resets on next provider mount.
  const dismissedThisSessionRef = useRef(false);

  // DIAGNOSTIC (tour-restart-skip-broken): mount/unmount tracking
  useEffect(() => {
    __tourProviderMountCount += 1;
    const myMountId = __tourProviderMountCount;
    // eslint-disable-next-line no-console
    console.log('[tour-debug] TourProvider MOUNT', {
      mountCount: myMountId,
      gitCommit: process.env.NEXT_PUBLIC_GIT_COMMIT,
      pathname,
      timestamp: new Date().toISOString(),
    });
    return () => {
      // eslint-disable-next-line no-console
      console.log('[tour-debug] TourProvider UNMOUNT', {
        mountId: myMountId,
        timestamp: new Date().toISOString(),
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-start gating — Phase 8 D-11:
  //   status === 'authenticated'
  //   AND (isDemoAccount OR !hasSeenTour)    (Phase 6 D-03)
  //   AND pathname === '/dashboard'           (D-05)
  // If pathname is not /dashboard, trigger a one-shot router.push('/dashboard') (D-07),
  // then wait for the effect to re-run after the route change.
  // On match, wait ~150ms for the dashboard to paint before setIsActive(true) (D-11).
  useEffect(() => {
    // DIAGNOSTIC (tour-restart-skip-broken)
    const _user = session?.user as { hasSeenTour?: boolean; isDemoAccount?: boolean } | undefined;
    // eslint-disable-next-line no-console
    console.log('[tour-debug] autostart effect RUN', {
      status,
      pathname,
      isActive,
      dismissedRef: dismissedThisSessionRef.current,
      hasSeenTour: _user?.hasSeenTour,
      isDemoAccount: _user?.isDemoAccount,
      hasPushedRef: hasPushedRef.current,
      timestamp: new Date().toISOString(),
    });

    if (status !== 'authenticated' || !session?.user) return;
    if (dismissedThisSessionRef.current) {
      // eslint-disable-next-line no-console
      console.log('[tour-debug] autostart BLOCKED by dismissedRef gate');
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
    // eslint-disable-next-line no-console
    console.log('[tour-debug] autostart SCHEDULING setIsActive(true) in 150ms');
    autoStartTimerRef.current = setTimeout(() => {
      // eslint-disable-next-line no-console
      console.log('[tour-debug] autostart FIRING setIsActive(true)');
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
    // eslint-disable-next-line no-console
    console.log('[tour-debug] handleComplete called', { timestamp: new Date().toISOString() });
    dismissedThisSessionRef.current = true;
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
    // eslint-disable-next-line no-console
    console.log('[tour-debug] abort called', { timestamp: new Date().toISOString() });
    dismissedThisSessionRef.current = true;
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
