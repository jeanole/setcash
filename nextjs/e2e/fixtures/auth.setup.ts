/**
 * Auth Setup — Logs in each test user and saves browser storage state
 *
 * This runs as a Playwright "setup" project before any test suites,
 * so individual tests can reuse authenticated sessions without re-logging in.
 */

import { test as setup, expect } from '@playwright/test';
import { USERS, STORAGE_STATE } from './constants';
import fs from 'fs';
import path from 'path';

// Ensure .auth directory exists
const authDir = path.resolve(__dirname, '../../e2e/.auth');
if (!fs.existsSync(authDir)) {
  fs.mkdirSync(authDir, { recursive: true });
}

async function loginAndSave(
  page: ReturnType<typeof setup['info']> extends never ? never : Parameters<Parameters<typeof setup>[1]>[0]['page'],
  email: string,
  password: string,
  storageStatePath: string
) {
  await page.goto('/');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();

  // Wait for redirect to dashboard (authenticated)
  await page.waitForURL('**/dashboard', { timeout: 15_000 });
  await expect(page.locator('body')).toBeVisible();

  // Save storage state
  await page.context().storageState({ path: storageStatePath });
}

setup('authenticate admin user', async ({ page }) => {
  await loginAndSave(page, USERS.admin.email, USERS.admin.password, STORAGE_STATE.admin);
});

setup('authenticate regular user', async ({ page }) => {
  await loginAndSave(page, USERS.user.email, USERS.user.password, STORAGE_STATE.user);
});

setup('authenticate second user', async ({ page }) => {
  await loginAndSave(page, USERS.user2.email, USERS.user2.password, STORAGE_STATE.user2);
});

setup('authenticate superadmin', async ({ page }) => {
  await loginAndSave(page, USERS.superadmin.email, USERS.superadmin.password, STORAGE_STATE.superadmin);
});

setup('authenticate demo user', async ({ page }) => {
  await loginAndSave(page, USERS.demo.email, USERS.demo.password, STORAGE_STATE.demo);
});
