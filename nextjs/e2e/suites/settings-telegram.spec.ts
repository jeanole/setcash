/**
 * Telegram Integration Settings — P2
 *
 * Tests Telegram linking, status, and configuration.
 */

import { test, expect } from '../fixtures/test-fixtures';

test.describe('Telegram Integration @p2', () => {
  test('admin can access Telegram settings page', async ({ adminPage }) => {
    await adminPage.goto('/settings/telegram');
    await adminPage.waitForURL('**/settings/telegram');
    await expect(adminPage.getByText(/telegram/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('telegram status API returns data', async ({ adminPage }) => {
    const response = await adminPage.request.get('/api/telegram/status');
    expect(response.status()).toBe(200);
  });

  test('generate link code returns code or not-enabled error', async ({ adminPage }) => {
    const response = await adminPage.request.get('/api/telegram/link-code');
    // 200 if Telegram is enabled, 400 if not enabled for this project
    expect([200, 400, 429]).toContain(response.status());
    if (response.status() === 200) {
      const data = await response.json();
      expect(data.code).toBeTruthy();
    }
  });

  test('link code endpoint does not crash under repeated requests', async ({ adminPage }) => {
    const responses: number[] = [];
    for (let i = 0; i < 8; i++) {
      const response = await adminPage.request.get('/api/telegram/link-code');
      responses.push(response.status());
    }
    // Should not crash — 200, 400 (not enabled), or 429 (rate limited) are all acceptable
    expect(responses.every((s) => s !== 500)).toBeTruthy();
  });
});
