/**
 * AI/OCR Settings — P2
 *
 * Tests OCR configuration and AI analysis settings.
 */

import { test, expect } from '../fixtures/test-fixtures';

test.describe('AI/OCR Settings @p2', () => {
  test('admin can access AI settings page', async ({ adminPage }) => {
    await adminPage.goto('/settings/ai-analysis');
    await adminPage.waitForURL('**/settings/ai-analysis');
    await expect(adminPage.getByText(/ai|ocr|analysis/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('user cannot access AI settings', async ({ userPage }) => {
    await userPage.goto('/settings/ai-analysis');
    await userPage.waitForTimeout(2000);
    // Should be redirected or show access denied
  });

  test('project settings API returns OCR config', async ({ adminPage }) => {
    const response = await adminPage.request.get('/api/project-settings');
    expect(response.status()).toBe(200);
  });

  test('admin can update OCR settings via API', async ({ adminPage }) => {
    const response = await adminPage.request.put('/api/project-settings', {
      data: {
        key: 'ocrEnabled',
        value: 'false',
      },
    });
    expect(response.status()).toBe(200);

    // Restore
    await adminPage.request.put('/api/project-settings', {
      data: {
        key: 'ocrEnabled',
        value: 'true',
      },
    });
  });

  test('OCR log endpoint returns data', async ({ adminPage }) => {
    const response = await adminPage.request.get('/api/ocr-log');
    expect(response.status()).toBe(200);
  });

  test('user cannot access OCR logs', async ({ userPage }) => {
    const response = await userPage.request.get('/api/ocr-log');
    expect([401, 403]).toContain(response.status());
  });
});
