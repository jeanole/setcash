// ---------------------------------------------------------------------------
// Tour step configuration — single source of truth for onboarding tour
// ---------------------------------------------------------------------------

export interface TourStep {
  id: string;
  targetSelector: string;
  title: string;
  body: string;
  placement: 'top' | 'bottom' | 'left' | 'right';
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'sidebar-nav',
    targetSelector: '[data-tour="sidebar-nav"]',
    title: 'Navigation',
    body: 'Use the sidebar to switch between sections like Bills, Budget, and Settings.',
    placement: 'right',
  },
  {
    id: 'submit-bill',
    targetSelector: '[data-tour="submit-bill"]',
    title: 'Submit a Bill',
    body: 'Click here to submit a new expense bill with a photo and details.',
    placement: 'bottom',
  },
  {
    id: 'bill-list',
    targetSelector: '[data-tour="bill-list"]',
    title: 'Your Bills',
    body: 'View and track all your submitted bills and their approval status.',
    placement: 'top',
  },
  {
    id: 'budget-matrix',
    targetSelector: '[data-tour="budget-matrix"]',
    title: 'Budget Overview',
    body: 'See how spending compares to your budget across all categories.',
    placement: 'bottom',
  },
  {
    id: 'project-switcher',
    targetSelector: '[data-tour="project-switcher"]',
    title: 'Switch Projects',
    body: 'If you belong to multiple projects, switch between them here.',
    placement: 'bottom',
  },
  {
    id: 'user-menu',
    targetSelector: '[data-tour="user-menu"]',
    title: 'Your Account',
    body: 'Access your profile settings, change your password, or sign out.',
    placement: 'left',
  },
] as const;
