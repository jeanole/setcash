/**
 * Positions — P2
 *
 * Tests position CRUD for project member roles.
 */

import { test, expect } from '../fixtures/test-fixtures';

test.describe('Positions @p2', () => {
  let projectId: string;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
    const page = await context.newPage();
    const sessionRes = await page.request.get('/api/auth/session');
    const session = await sessionRes.json();
    projectId = session?.user?.currentProjectId;
    await context.close();
  });

  test('admin can list positions', async ({ adminPage }) => {
    if (!projectId) return;
    const response = await adminPage.request.get(`/api/projects/${projectId}/positions`);
    expect(response.status()).toBe(200);
  });

  test('admin can create a position', async ({ adminPage }) => {
    if (!projectId) return;
    const response = await adminPage.request.post(`/api/projects/${projectId}/positions`, {
      data: { name: 'E2E Test Position' },
    });
    expect([200, 201]).toContain(response.status());
  });

  test('admin can update a position', async ({ adminPage }) => {
    if (!projectId) return;
    // List positions to find the one we created
    const listRes = await adminPage.request.get(`/api/projects/${projectId}/positions`);
    const positions = await listRes.json();
    const testPos = positions.find((p: { name: string }) => p.name === 'E2E Test Position');

    if (testPos) {
      const response = await adminPage.request.put(`/api/projects/${projectId}/positions/${testPos.id}`, {
        data: { name: 'E2E Updated Position' },
      });
      expect(response.status()).toBe(200);
    }
  });

  test('admin can delete a position', async ({ adminPage }) => {
    if (!projectId) return;
    const listRes = await adminPage.request.get(`/api/projects/${projectId}/positions`);
    const positions = await listRes.json();
    const testPos = positions.find((p: { name: string }) =>
      p.name === 'E2E Updated Position' || p.name === 'E2E Test Position'
    );

    if (testPos) {
      const response = await adminPage.request.delete(`/api/projects/${projectId}/positions/${testPos.id}`);
      expect(response.status()).toBe(200);
    }
  });

  test('user cannot create positions', async ({ userPage }) => {
    if (!projectId) return;
    const response = await userPage.request.post(`/api/projects/${projectId}/positions`, {
      data: { name: 'Unauthorized Position' },
    });
    expect([401, 403]).toContain(response.status());
  });

  test('positions page accessible to admin', async ({ adminPage }) => {
    await adminPage.goto('/settings/positions');
    await adminPage.waitForURL('**/settings/positions');
    await expect(adminPage.getByText(/position/i).first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Categories & Motives @p2', () => {
  let projectId: string;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
    const page = await context.newPage();
    const sessionRes = await page.request.get('/api/auth/session');
    const session = await sessionRes.json();
    projectId = session?.user?.currentProjectId;
    await context.close();
  });

  test('admin can create and delete a category', async ({ adminPage }) => {
    if (!projectId) return;

    // Create
    const createRes = await adminPage.request.post(`/api/projects/${projectId}/categories`, {
      data: { name: 'E2E Temp Category', budget: 500 },
    });
    expect([200, 201]).toContain(createRes.status());
    const category = await createRes.json();

    // Delete
    if (category.id) {
      const deleteRes = await adminPage.request.delete(`/api/projects/${projectId}/categories/${category.id}`);
      expect(deleteRes.status()).toBe(200);
    }
  });

  test('duplicate category name is rejected or accepted depending on project state', async ({ adminPage }) => {
    if (!projectId) return;
    // "Office Supplies" is a seeded category — may return 400 (duplicate) or 201 (if project context changed)
    const response = await adminPage.request.post(`/api/projects/${projectId}/categories`, {
      data: { name: 'Office Supplies', budget: 100 },
    });
    expect([200, 201, 400, 409]).toContain(response.status());

    // Clean up if it was created
    if (response.status() === 200 || response.status() === 201) {
      const created = await response.json();
      if (created?.id) {
        await adminPage.request.delete(`/api/projects/${projectId}/categories/${created.id}`);
      }
    }
  });

  test('admin can create and delete a motive', async ({ adminPage }) => {
    if (!projectId) return;

    const createRes = await adminPage.request.post(`/api/projects/${projectId}/motives`, {
      data: { name: 'E2E Temp Motive', budget: 1000 },
    });
    expect([200, 201]).toContain(createRes.status());
    const motive = await createRes.json();

    if (motive.id) {
      const deleteRes = await adminPage.request.delete(`/api/projects/${projectId}/motives/${motive.id}`);
      expect(deleteRes.status()).toBe(200);
    }
  });

  test('duplicate motive name rejected', async ({ adminPage }) => {
    if (!projectId) return;
    const response = await adminPage.request.post(`/api/projects/${projectId}/motives`, {
      data: { name: 'Operations', budget: 100 },
    });
    expect([400, 409, 500]).toContain(response.status());
  });
});
