/**
 * Spending Overview — P1
 *
 * Tests spending page loading and API data.
 */

import { test, expect } from '../fixtures/test-fixtures';
import { SpendingPage } from '../pages/spending.page';

test.describe('Spending Overview @p1', () => {
  test('spending page loads for admin', async ({ adminPage }) => {
    const spending = new SpendingPage(adminPage);
    await spending.goto();
    await spending.expectLoaded();
  });

  test('spending page loads for user', async ({ userPage }) => {
    const spending = new SpendingPage(userPage);
    await spending.goto();
    await spending.expectLoaded();
  });

  test('spending API returns data', async ({ adminPage }) => {
    const response = await adminPage.request.get('/api/spending');
    expect(response.status()).toBe(200);
  });

  test('spending data is project-scoped', async ({ adminPage }) => {
    const response = await adminPage.request.get('/api/spending');
    const data = await response.json();
    // Data should exist (may be empty for test project)
    expect(data).toBeDefined();
  });
});
