/**
 * Shared constants for E2E tests — test users, projects, and IDs
 */

// ---------------------------------------------------------------------------
// Test Users
// ---------------------------------------------------------------------------

export const TEST_PASSWORD = 'TestPass123!';

export const USERS = {
  admin: {
    email: 'e2e-admin@test.local',
    password: TEST_PASSWORD,
    firstName: 'Admin',
    lastName: 'Tester',
  },
  user: {
    email: 'e2e-user@test.local',
    password: TEST_PASSWORD,
    firstName: 'Regular',
    lastName: 'User',
  },
  user2: {
    email: 'e2e-user2@test.local',
    password: TEST_PASSWORD,
    firstName: 'Second',
    lastName: 'User',
  },
  orphan: {
    email: 'e2e-orphan@test.local',
    password: TEST_PASSWORD,
    firstName: 'No',
    lastName: 'Project',
  },
  superadmin: {
    email: 'e2e-super@test.local',
    password: TEST_PASSWORD,
    firstName: 'Super',
    lastName: 'Admin',
  },
  demo: {
    email: 'e2e-demo@test.local',
    password: TEST_PASSWORD,
    firstName: 'Demo',
    lastName: 'Account',
  },
  disabled: {
    email: 'e2e-disabled@test.local',
    password: TEST_PASSWORD,
    firstName: 'Disabled',
    lastName: 'User',
  },
} as const;

// ---------------------------------------------------------------------------
// Test Projects
// ---------------------------------------------------------------------------

export const PROJECTS = {
  a: { name: 'E2E Project Alpha' },
  b: { name: 'E2E Project Beta' },
  example: { name: 'E2E Example Project' },
} as const;

// ---------------------------------------------------------------------------
// Test Categories & Motives
// ---------------------------------------------------------------------------

export const CATEGORIES = {
  a: ['Office Supplies', 'Travel', 'Food & Drinks'],
  b: ['Supplies', 'Services'],
} as const;

export const MOTIVES = {
  a: ['Operations', 'Marketing', 'R&D'],
  b: ['Sales', 'Support'],
} as const;

// ---------------------------------------------------------------------------
// Storage state paths (for authenticated sessions)
// ---------------------------------------------------------------------------

export const AUTH_DIR = 'e2e/.auth';
export const STORAGE_STATE = {
  admin: `${AUTH_DIR}/admin.json`,
  user: `${AUTH_DIR}/user.json`,
  user2: `${AUTH_DIR}/user2.json`,
  superadmin: `${AUTH_DIR}/superadmin.json`,
  demo: `${AUTH_DIR}/demo.json`,
} as const;
