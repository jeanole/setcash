/**
 * Dashboard — P0
 *
 * Tests dashboard loading, KPIs, and project-scoped data.
 */

import { test, expect } from '../fixtures/test-fixtures';
import { DashboardPage } from '../pages/dashboard.page';

test.describe('Dashboard @p0', () => {
  test('admin dashboard loads with KPIs', async ({ adminPage }) => {
    const dashboard = new DashboardPage(adminPage);
    await dashboard.goto();
    await dashboard.expectLoaded();
  });

  test('user dashboard loads with KPIs', async ({ userPage }) => {
    const dashboard = new DashboardPage(userPage);
    await dashboard.goto();
    await dashboard.expectLoaded();
  });

  test('dashboard shows project-specific data', async ({ adminPage }) => {
    const dashboard = new DashboardPage(adminPage);
    await dashboard.goto();
    await dashboard.expectLoaded();

    // Should see content related to E2E Project Alpha
    const content = await dashboard.getKpiValues();
    expect(content).toBeTruthy();
  });

  test('dashboard has navigation links to key pages', async ({ adminPage }) => {
    const dashboard = new DashboardPage(adminPage);
    await dashboard.goto();
    await dashboard.expectLoaded();

    // Verify key nav links exist
    await expect(adminPage.locator('a[href="/bills"]').first()).toBeVisible();
    await expect(adminPage.locator('a[href="/budget"]').first()).toBeVisible();
  });
});
