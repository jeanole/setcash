/**
 * Navigation & Layout — P1
 *
 * Tests sidebar navigation, responsive layout, admin visibility, and theme toggle.
 */

import { test, expect } from '../fixtures/test-fixtures';
import { NavigationHelper } from '../pages/navigation.page';

test.describe('Sidebar Navigation @p1', () => {
  test('all main nav links work for admin', async ({ adminPage }) => {
    const nav = new NavigationHelper(adminPage);
    await adminPage.goto('/dashboard');
    await adminPage.waitForURL('**/dashboard');

    // Navigate to each section
    const sections: Array<'bills' | 'budget' | 'spending' | 'vgeld' | 'settings'> = [
      'bills', 'budget', 'spending', 'vgeld', 'settings',
    ];

    for (const section of sections) {
      await nav.navigateTo(section);
      await expect(adminPage).toHaveURL(new RegExp(section));
    }
  });

  test('active nav item is highlighted', async ({ adminPage }) => {
    await adminPage.goto('/bills');
    await adminPage.waitForURL('**/bills');

    const billsLink = adminPage.locator('a[href="/bills"]').first();
    // Check for active indicator (aria-current or specific class)
    const ariaCurrent = await billsLink.getAttribute('aria-current');
    const className = await billsLink.getAttribute('class');

    expect(
      ariaCurrent === 'page' ||
      className?.includes('active') ||
      className?.includes('accent')
    ).toBeTruthy();
  });
});

test.describe('Admin Nav Visibility @p1', () => {
  test('admin sees settings nav items', async ({ adminPage }) => {
    await adminPage.goto('/dashboard');
    await adminPage.waitForURL('**/dashboard');

    await expect(adminPage.locator('a[href="/settings"]').first()).toBeVisible();
  });

  test('superadmin sees system admin button', async ({ superadminPage }) => {
    await superadminPage.goto('/dashboard');
    await superadminPage.waitForURL('**/dashboard');

    const nav = new NavigationHelper(superadminPage);
    await expect(nav.superAdminButton).toBeVisible();
  });

  test('regular user does not see system admin button', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForURL('**/dashboard');

    const nav = new NavigationHelper(userPage);
    await expect(nav.superAdminButton).not.toBeVisible();
  });
});

test.describe('Responsive Layout @p1', () => {
  test('mobile layout shows hamburger menu', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: 'e2e/.auth/admin.json',
      viewport: { width: 375, height: 812 },
    });
    const page = await context.newPage();
    await page.goto('/dashboard');
    await page.waitForURL('**/dashboard');

    const nav = new NavigationHelper(page);
    await expect(nav.mobileMenuButton).toBeVisible();

    await context.close();
  });

  test('mobile menu opens and shows nav links', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: 'e2e/.auth/admin.json',
      viewport: { width: 375, height: 812 },
    });
    const page = await context.newPage();
    await page.goto('/dashboard');
    await page.waitForURL('**/dashboard');

    const nav = new NavigationHelper(page);
    await nav.openMobileMenu();

    // Nav links should be visible in the mobile navigation panel
    await expect(
      page.locator('[aria-label="Mobile main menu"] a[href="/bills"]')
    ).toBeVisible({ timeout: 5_000 });

    await context.close();
  });

  test('desktop layout shows sidebar directly', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: 'e2e/.auth/admin.json',
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    await page.goto('/dashboard');
    await page.waitForURL('**/dashboard');

    // Sidebar nav should be directly visible
    await expect(page.locator('a[href="/bills"]').first()).toBeVisible();

    await context.close();
  });
});

test.describe('Header Elements @p1', () => {
  test('header shows upload button', async ({ adminPage }) => {
    await adminPage.goto('/dashboard');
    const nav = new NavigationHelper(adminPage);
    await expect(nav.uploadButton).toBeVisible();
  });

  test('header shows profile button', async ({ adminPage }) => {
    await adminPage.goto('/dashboard');
    const nav = new NavigationHelper(adminPage);
    await expect(nav.profileButton).toBeVisible();
  });
});
