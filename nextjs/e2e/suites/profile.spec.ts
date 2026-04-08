/**
 * User Profile — P1
 *
 * Tests profile viewing, editing, and password change.
 */

import { test, expect } from '../fixtures/test-fixtures';
import { USERS, TEST_PASSWORD } from '../fixtures/constants';

test.describe('Profile API @p1', () => {
  test('get current user profile', async ({ adminPage }) => {
    const response = await adminPage.request.get('/api/users/me');
    expect(response.status()).toBe(200);

    const user = await response.json();
    expect(user.email).toBe(USERS.admin.email);
    expect(user.firstName).toBe(USERS.admin.firstName);
  });

  test('update user profile', async ({ user2Page }) => {
    const response = await user2Page.request.patch('/api/users/me', {
      data: {
        firstName: 'Updated',
        lastName: 'Name',
      },
    });
    expect(response.status()).toBe(200);

    // Verify update persisted
    const verify = await user2Page.request.get('/api/users/me');
    const user = await verify.json();
    expect(user.firstName).toBe('Updated');

    // Restore original
    await user2Page.request.patch('/api/users/me', {
      data: {
        firstName: USERS.user2.firstName,
        lastName: USERS.user2.lastName,
      },
    });
  });
});

test.describe('Password Change @p1', () => {
  test('change password with correct current password', async ({ user2Page }) => {
    const newPassword = 'NewPass456!';

    const response = await user2Page.request.patch('/api/users/me/password', {
      data: {
        currentPassword: TEST_PASSWORD,
        newPassword,
      },
    });
    expect(response.status()).toBe(200);

    // Restore original password
    await user2Page.request.patch('/api/users/me/password', {
      data: {
        currentPassword: newPassword,
        newPassword: TEST_PASSWORD,
      },
    });
  });

  test('change password with wrong current password fails', async ({ userPage }) => {
    const response = await userPage.request.patch('/api/users/me/password', {
      data: {
        currentPassword: 'WrongCurrentPass!',
        newPassword: 'NewPass456!',
      },
    });
    // 429 possible if rate limited from prior test
    expect([400, 401, 403, 429]).toContain(response.status());
  });

  test('change password with weak new password fails', async ({ userPage }) => {
    const response = await userPage.request.patch('/api/users/me/password', {
      data: {
        currentPassword: TEST_PASSWORD,
        newPassword: 'weak',
      },
    });
    // 429 possible if rate limited from prior test
    expect([400, 422, 429]).toContain(response.status());
  });
});
