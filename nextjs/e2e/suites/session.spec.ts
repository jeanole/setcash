/**
 * Session & Token Handling — P0
 *
 * Tests JWT behavior, session refresh, and project context in tokens.
 */

import { test, expect } from '../fixtures/test-fixtures';

test.describe('Session Management @p0', () => {
  test('session contains correct user fields', async ({ adminPage }) => {
    const response = await adminPage.request.get('/api/auth/session');
    const session = await response.json();

    expect(session.user).toBeDefined();
    expect(session.user.email).toBeTruthy();
    expect(session.user.currentProjectId).toBeTruthy();
    expect(session.user.currentProjectRole).toBeTruthy();
    expect(session.user.currentProjectName).toBeTruthy();
  });

  test('admin session has admin role', async ({ adminPage }) => {
    const response = await adminPage.request.get('/api/auth/session');
    const session = await response.json();

    expect(['admin', 'owner']).toContain(session.user.currentProjectRole);
  });

  test('user session has user role', async ({ userPage }) => {
    const response = await userPage.request.get('/api/auth/session');
    const session = await response.json();

    expect(session.user.currentProjectRole).toBe('user');
  });

  test('superadmin session has superadmin role', async ({ superadminPage }) => {
    const response = await superadminPage.request.get('/api/auth/session');
    const session = await response.json();

    expect(session.user.role).toBe('superadmin');
  });

  test('demo session is marked as demo', async ({ demoPage }) => {
    const response = await demoPage.request.get('/api/auth/session');
    const session = await response.json();

    expect(session.user.isDemoAccount).toBe(true);
    expect(session.user.isExampleProject).toBe(true);
  });

  test('project switch updates session', async ({ adminPage }) => {
    // Get initial session
    const before = await (await adminPage.request.get('/api/auth/session')).json();
    const initialProjectId = before.user.currentProjectId;

    // Get list of projects
    const projectsRes = await adminPage.request.get('/api/projects');
    const projects = await projectsRes.json();

    // Find a different project
    const otherProject = projects.find((p: { id: string }) => p.id !== initialProjectId);
    if (!otherProject) return; // Only one project — skip

    // Switch project
    const switchRes = await adminPage.request.post('/api/projects/switch', {
      data: { projectId: otherProject.id },
    });
    expect(switchRes.status()).toBe(200);

    // Verify session updated
    const after = await (await adminPage.request.get('/api/auth/session')).json();
    expect(after.user.currentProjectId).toBe(otherProject.id);

    // Switch back
    await adminPage.request.post('/api/projects/switch', {
      data: { projectId: initialProjectId },
    });
  });

  test('non-member cannot switch to foreign project', async ({ userPage }) => {
    const response = await userPage.request.post('/api/projects/switch', {
      data: { projectId: 'nonexistent-project-id' },
    });
    expect([400, 403, 404]).toContain(response.status());
  });
});

test.describe('Health Check @p0', () => {
  test('health endpoint returns 200', async ({ page }) => {
    const response = await page.request.get('/api/health');
    expect(response.status()).toBe(200);
  });
});
