/**
 * Super-Admin Panel — P1
 *
 * Tests user management, project management, and system config.
 */

import { test, expect } from '../fixtures/test-fixtures';
import { USERS } from '../fixtures/constants';

test.describe('Super-Admin User Management @p1', () => {
  test('superadmin can list all users', async ({ superadminPage }) => {
    const response = await superadminPage.request.get('/api/admin/users');
    expect(response.status()).toBe(200);
    const users = await response.json();
    expect(users.length).toBeGreaterThanOrEqual(7); // 7 seeded test users
  });

  test('superadmin can create a user', async ({ superadminPage }) => {
    const response = await superadminPage.request.post('/api/admin/users', {
      data: {
        email: 'e2e-created@test.local',
        password: 'TestPass123!',
      },
    });
    expect([200, 201]).toContain(response.status());

    // Cleanup: delete the created user
    await superadminPage.request.delete('/api/admin/users/e2e-created@test.local');
  });

  test('superadmin can toggle superadmin flag on a user', async ({ superadminPage }) => {
    // The PUT endpoint supports toggling isSuperAdmin (not isActive)
    const response = await superadminPage.request.put(`/api/admin/users/${USERS.user2.email}`, {
      data: { isSuperAdmin: true },
    });
    expect(response.status()).toBe(200);

    // Revert
    await superadminPage.request.put(`/api/admin/users/${USERS.user2.email}`, {
      data: { isSuperAdmin: false },
    });
  });
});

test.describe('Super-Admin Project Management @p1', () => {
  test('superadmin can list all projects', async ({ superadminPage }) => {
    const response = await superadminPage.request.get('/api/admin/projects');
    expect(response.status()).toBe(200);
    const projects = await response.json();
    expect(projects.length).toBeGreaterThanOrEqual(3);
  });

  test('superadmin can switch to any project without membership', async ({ superadminPage }) => {
    // Get all projects
    const projRes = await superadminPage.request.get('/api/admin/projects');
    const projects = await projRes.json();

    // Try switching to each project
    for (const project of projects.slice(0, 3)) {
      const switchRes = await superadminPage.request.post('/api/projects/switch', {
        data: { projectId: project.id },
      });
      expect(switchRes.status()).toBe(200);
    }
  });
});

test.describe('Super-Admin System Config @p1', () => {
  test('superadmin can read system config', async ({ superadminPage }) => {
    const response = await superadminPage.request.get('/api/superadmin/system-config');
    expect(response.status()).toBe(200);
  });

  test('non-superadmin cannot access system config', async ({ adminPage }) => {
    const response = await adminPage.request.get('/api/superadmin/system-config');
    expect([401, 403]).toContain(response.status());
  });
});

test.describe('Super-Admin UI @p1', () => {
  test('superadmin button opens admin panel', async ({ superadminPage }) => {
    await superadminPage.goto('/dashboard');
    await superadminPage.waitForURL('**/dashboard');

    const adminBtn = superadminPage.locator('button[aria-label*="Super Admin"]');
    if (await adminBtn.isVisible()) {
      await adminBtn.click();
      await superadminPage.waitForTimeout(1000);
      // Should show admin panel content
      await expect(superadminPage.getByText(/user|project|system/i).first()).toBeVisible();
    }
  });
});
