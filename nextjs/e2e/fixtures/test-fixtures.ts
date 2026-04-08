/**
 * Custom Playwright fixtures — pre-authenticated pages for each role
 *
 * Usage in test files:
 *   import { test, expect } from '../fixtures/test-fixtures';
 *
 *   test('admin can do X', async ({ adminPage }) => { ... });
 *   test('user can see Y', async ({ userPage }) => { ... });
 */

import { test as base, expect, Page } from '@playwright/test';
import { STORAGE_STATE } from './constants';

type TestFixtures = {
  adminPage: Page;
  userPage: Page;
  user2Page: Page;
  superadminPage: Page;
  demoPage: Page;
};

export const test = base.extend<TestFixtures>({
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: STORAGE_STATE.admin });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  userPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: STORAGE_STATE.user });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  user2Page: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: STORAGE_STATE.user2 });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  superadminPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: STORAGE_STATE.superadmin });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  demoPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: STORAGE_STATE.demo });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect };
