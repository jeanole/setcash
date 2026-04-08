/**
 * Demo Account — P1
 *
 * Tests demo account restrictions and capabilities.
 */

import { test, expect } from '../fixtures/test-fixtures';
import { DashboardPage } from '../pages/dashboard.page';

test.describe('Demo Account @p1', () => {
  test('demo user can access dashboard', async ({ demoPage }) => {
    const dashboard = new DashboardPage(demoPage);
    await dashboard.goto();
    await dashboard.expectLoaded();
  });

  test('demo session is flagged correctly', async ({ demoPage }) => {
    const response = await demoPage.request.get('/api/auth/session');
    const session = await response.json();

    expect(session.user.isDemoAccount).toBe(true);
    expect(session.user.isExampleProject).toBe(true);
  });

  test('demo user can view bills', async ({ demoPage }) => {
    await demoPage.goto('/bills');
    await demoPage.waitForURL('**/bills');
    await expect(demoPage.getByText(/bills/i).first()).toBeVisible();
  });

  test('demo user sees restriction on bill creation in example project', async ({ demoPage }) => {
    await demoPage.goto('/bills/new');
    await demoPage.waitForURL('**/bills/new');
    // Example Project blocks bill creation — show restriction notice
    await expect(demoPage.getByText(/not available in example project/i)).toBeVisible({ timeout: 10_000 });
  });

  test('demo user cannot switch projects via API', async ({ demoPage }) => {
    const response = await demoPage.request.post('/api/projects/switch', {
      data: { projectId: 'some-other-project' },
    });
    // Should fail — demo is locked to Example Project
    expect([400, 403, 404]).toContain(response.status());
  });

  test('demo user cannot send invitations', async ({ demoPage }) => {
    const sessionRes = await demoPage.request.get('/api/auth/session');
    const session = await sessionRes.json();
    const projectId = session?.user?.currentProjectId;

    if (projectId) {
      const response = await demoPage.request.post(`/api/projects/${projectId}/invite`, {
        data: { email: 'someone@example.com' },
      });
      expect([401, 403]).toContain(response.status());
    }
  });
});
