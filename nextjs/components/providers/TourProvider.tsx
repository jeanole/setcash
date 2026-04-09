'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';
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

  // Determine whether to show the tour once session is loaded
  // Per D-09: read hasSeenTour and isDemoAccount from session
  // Per D-03: demo users always see the tour regardless of hasSeenTour
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user) return;

    const user = session.user as { hasSeenTour?: boolean; isDemoAccount?: boolean };
    const isDemoAccount = user.isDemoAccount ?? false;
    const hasSeenTour = user.hasSeenTour ?? false;

    if (isDemoAccount || !hasSeenTour) {
      setIsActive(true);
      setCurrentStep(0);
    }
  }, [status, session]);

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

  const value: TourContextValue = {
    isActive,
    currentStep,
    stepCount,
    next,
    back,
    skip,
    complete: handleComplete,
  };

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}
