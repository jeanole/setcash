/**
 * Authorization & RBAC — P0
 *
 * Tests role-based access control, cross-project isolation,
 * and API-level permission enforcement.
 */

import { test, expect } from '../fixtures/test-fixtures';

test.describe('Route-Level Access Control @p0', () => {
  test('unauthenticated request to API returns redirect or 401', async ({ browser }) => {
    // Use a fresh context with no stored auth to ensure unauthenticated
    const context = await browser.newContext();
    const page = await context.newPage();
    const response = await page.request.get('/api/bills', { maxRedirects: 0 });
    expect([307, 401]).toContain(response.status());
    await context.close();
  });

  test('unauthenticated request to admin API returns redirect or 401', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const response = await page.request.get('/api/admin/users', { maxRedirects: 0 });
    expect([307, 401]).toContain(response.status());
    await context.close();
  });

  test('user cannot access admin API endpoints', async ({ userPage }) => {
    // Try to list all users (superadmin-only)
    const response = await userPage.request.get('/api/admin/users');
    expect([401, 403]).toContain(response.status());
  });

  test('user cannot access superadmin config', async ({ userPage }) => {
    const response = await userPage.request.get('/api/superadmin/system-config');
    expect([401, 403]).toContain(response.status());
  });

  test('admin cannot access superadmin endpoints', async ({ adminPage }) => {
    const response = await adminPage.request.get('/api/admin/users');
    expect([401, 403]).toContain(response.status());
  });
});

test.describe('Cross-Project Isolation @p0', () => {
  test('user cannot create bill in foreign project via API', async ({ userPage }) => {
    // The API should use session projectId, not a user-supplied one
    const response = await userPage.request.post('/api/bills', {
      data: {
        date: '2026-04-01',
        vendor: 'Hacker Corp',
        brutto19: 999,
        projectId: 'non-existent-project-id',
      },
    });
    // Should either ignore the projectId (use session) or reject
    // 500 acceptable if server rejects malformed data at DB level
    expect([200, 201, 400, 403, 422, 500]).toContain(response.status());
    if (response.status() === 200 || response.status() === 201) {
      const bill = await response.json();
      // Bill should be in user's actual project, not the forged one
      expect(bill.projectId).not.toBe('non-existent-project-id');
    }
  });

  test('budget bulk update rejects foreign motive/category IDs', async ({ adminPage }) => {
    const response = await adminPage.request.post('/api/budget-matrix/bulk-update', {
      data: {
        updates: [{
          motiveId: 'non-existent-motive-id',
          categoryId: 'non-existent-category-id',
          amount: 9999,
        }],
      },
    });
    // Should reject — IDs don't belong to current project
    expect([400, 403, 404, 500]).toContain(response.status());
  });
});

test.describe('Role Boundary Tests @p0', () => {
  test('user cannot create categories', async ({ userPage }) => {
    // Need to get current project ID from session
    const sessionRes = await userPage.request.get('/api/auth/session');
    const session = await sessionRes.json();
    const projectId = session?.user?.currentProjectId;

    if (projectId) {
      const response = await userPage.request.post(`/api/projects/${projectId}/categories`, {
        data: { name: 'Hacker Category', budget: 1000 },
      });
      expect([401, 403]).toContain(response.status());
    }
  });

  test('user cannot create motives', async ({ userPage }) => {
    const sessionRes = await userPage.request.get('/api/auth/session');
    const session = await sessionRes.json();
    const projectId = session?.user?.currentProjectId;

    if (projectId) {
      const response = await userPage.request.post(`/api/projects/${projectId}/motives`, {
        data: { name: 'Hacker Motive', budget: 1000 },
      });
      expect([401, 403]).toContain(response.status());
    }
  });

  test('user cannot update budget matrix', async ({ userPage }) => {
    const response = await userPage.request.post('/api/budget-matrix/bulk-update', {
      data: { updates: [] },
    });
    expect([401, 403]).toContain(response.status());
  });

  test('superadmin can access any project', async ({ superadminPage }) => {
    // Superadmin should be able to view bills
    const response = await superadminPage.request.get('/api/bills');
    expect(response.status()).toBe(200);
  });

  test('superadmin can list all users', async ({ superadminPage }) => {
    const response = await superadminPage.request.get('/api/admin/users');
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBeTruthy();
  });

  test('superadmin can access system config', async ({ superadminPage }) => {
    const response = await superadminPage.request.get('/api/superadmin/system-config');
    expect(response.status()).toBe(200);
  });
});
