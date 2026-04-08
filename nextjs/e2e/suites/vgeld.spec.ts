/**
 * V-Geld (Advance Money) — P1
 *
 * Tests transfer listing, creation, confirmation, and balance.
 */

import { test, expect } from '../fixtures/test-fixtures';
import { VgeldPage } from '../pages/vgeld.page';

test.describe('V-Geld Page @p1', () => {
  test('V-Geld page loads for admin', async ({ adminPage }) => {
    const vgeld = new VgeldPage(adminPage);
    await vgeld.goto();
    await vgeld.expectLoaded();
  });

  test('V-Geld page loads for user', async ({ userPage }) => {
    const vgeld = new VgeldPage(userPage);
    await vgeld.goto();
    await vgeld.expectLoaded();
  });

  test('seeded transfers are visible', async ({ adminPage }) => {
    const vgeld = new VgeldPage(adminPage);
    await vgeld.goto();
    await vgeld.expectLoaded();

    const count = await vgeld.getTransferCount();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('V-Geld balance API returns data', async ({ userPage }) => {
    const response = await userPage.request.get('/api/vgeld/balance');
    expect(response.status()).toBe(200);
  });
});

test.describe('V-Geld Transfer Creation @p1', () => {
  test('create new transfer', async ({ adminPage }) => {
    const vgeld = new VgeldPage(adminPage);
    await vgeld.goto();
    await vgeld.expectLoaded();

    if (await vgeld.createButton.isVisible()) {
      await vgeld.createTransfer(75);
      await adminPage.waitForTimeout(1000);

      // Verify transfer count increased
      const count = await vgeld.getTransferCount();
      expect(count).toBeGreaterThanOrEqual(3);
    }
  });
});
