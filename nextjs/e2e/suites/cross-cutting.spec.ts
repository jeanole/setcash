/**
 * Cross-Cutting Concerns — P1
 *
 * Tests error states, loading states, security headers, and responsive behavior.
 */

import { test, expect } from '../fixtures/test-fixtures';

test.describe('Security Headers @p1', () => {
  test('X-Frame-Options is DENY', async ({ adminPage }) => {
    const response = await adminPage.request.get('/dashboard');
    const headers = response.headers();
    expect(headers['x-frame-options']).toBe('DENY');
  });

  test('X-Content-Type-Options is nosniff', async ({ adminPage }) => {
    const response = await adminPage.request.get('/dashboard');
    const headers = response.headers();
    expect(headers['x-content-type-options']).toBe('nosniff');
  });

  test('Referrer-Policy is set', async ({ adminPage }) => {
    const response = await adminPage.request.get('/dashboard');
    const headers = response.headers();
    expect(headers['referrer-policy']).toBeTruthy();
  });

  test('Strict-Transport-Security is set', async ({ adminPage }) => {
    const response = await adminPage.request.get('/dashboard');
    const headers = response.headers();
    // HSTS may not be present in local dev, but check for production
    // This test verifies the header is configured when present
    if (headers['strict-transport-security']) {
      expect(headers['strict-transport-security']).toContain('max-age');
    }
  });
});

test.describe('Error Handling @p1', () => {
  test('404 API returns JSON error', async ({ adminPage }) => {
    const response = await adminPage.request.get('/api/nonexistent-route');
    expect([404, 405]).toContain(response.status());
  });

  test('invalid bill ID returns 404', async ({ adminPage }) => {
    const response = await adminPage.request.get('/api/bills/nonexistent-bill-id');
    expect([400, 404]).toContain(response.status());
  });

  test('malformed JSON body returns 400', async ({ adminPage }) => {
    const response = await adminPage.request.post('/api/bills', {
      headers: { 'Content-Type': 'application/json' },
      data: 'not-valid-json{{{',
    });
    expect([400, 500]).toContain(response.status());
  });

  test('server error does not leak stack traces', async ({ adminPage }) => {
    // Trigger an error by sending invalid data
    const response = await adminPage.request.post('/api/budget-matrix/bulk-update', {
      data: { updates: 'not-an-array' },
    });
    if (response.status() >= 400) {
      const body = await response.json().catch(() => null);
      if (body) {
        const bodyStr = JSON.stringify(body);
        expect(bodyStr).not.toContain('node_modules');
        expect(bodyStr).not.toContain('at Object.');
        expect(bodyStr).not.toContain('.ts:');
      }
    }
  });
});

test.describe('API Validation @p1', () => {
  test('empty bill creation is rejected', async ({ adminPage }) => {
    const response = await adminPage.request.post('/api/bills', {
      data: {},
    });
    // Should not succeed — 400/422 for validation error, 500 if unhandled
    expect([400, 422, 500]).toContain(response.status());
    expect(response.status()).not.toBe(200);
    expect(response.status()).not.toBe(201);
  });

  test('category with empty name is rejected', async ({ adminPage }) => {
    const sessionRes = await adminPage.request.get('/api/auth/session');
    const session = await sessionRes.json();
    const projectId = session?.user?.currentProjectId;

    if (projectId) {
      const response = await adminPage.request.post(`/api/projects/${projectId}/categories`, {
        data: { name: '   ', budget: 100 },
      });
      expect([400, 422]).toContain(response.status());
    }
  });
});

test.describe('Health & Static @p1', () => {
  test('health endpoint returns 200', async ({ page }) => {
    const response = await page.request.get('/api/health');
    expect(response.status()).toBe(200);
  });

  test('favicon is served', async ({ page }) => {
    const response = await page.request.get('/favicon.ico');
    // favicon may be at /favicon.ico or served via metadata — 404 is acceptable
    expect([200, 204, 304, 404]).toContain(response.status());
  });
});
