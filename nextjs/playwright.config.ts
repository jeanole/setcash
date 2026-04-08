import { defineConfig, devices } from '@playwright/test';

/**
 * SetCash E2E Test Configuration
 *
 * Usage:
 *   npx playwright test                    # Run all tests (Chromium)
 *   npx playwright test --project=firefox  # Specific browser
 *   npx playwright test suites/auth        # Specific suite
 *   npx playwright test --grep @p0         # Priority tag
 */
export default defineConfig({
  testDir: './e2e/suites',
  outputDir: './e2e/test-results',

  /* Parallel execution */
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,

  /* Fail fast in CI */
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,

  /* Reporter */
  reporter: process.env.CI
    ? [['html', { outputFolder: './e2e/playwright-report' }], ['junit', { outputFile: './e2e/results.xml' }]]
    : [['html', { outputFolder: './e2e/playwright-report', open: 'never' }]],

  /* Global setup: seed DB with test data */
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',

  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  projects: [
    /* Auth setup — runs first, saves storage state */
    {
      name: 'auth-setup',
      testDir: './e2e/fixtures',
      testMatch: 'auth.setup.ts',
    },

    /* Main test projects */
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['auth-setup'],
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      dependencies: ['auth-setup'],
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      dependencies: ['auth-setup'],
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
      dependencies: ['auth-setup'],
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
      dependencies: ['auth-setup'],
    },
  ],

  /* Dev server — start Next.js if not already running.
     When E2E_BASE_URL is set, skip launching a server (external server assumed). */
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000/api/health',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
