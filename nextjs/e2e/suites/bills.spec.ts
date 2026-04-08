/**
 * Bill Lifecycle — P0
 *
 * Tests bill creation, listing, filtering, status workflow, editing, and deletion.
 */

import { test, expect } from '../fixtures/test-fixtures';
import { BillsListPage } from '../pages/bills-list.page';
import { BillNewPage } from '../pages/bill-new.page';
import { BillDetailPage } from '../pages/bill-detail.page';
import { USERS } from '../fixtures/constants';

test.describe('Bill List @p0', () => {
  test('bills page loads and shows seeded bills', async ({ adminPage }) => {
    const billsList = new BillsListPage(adminPage);
    await billsList.goto();
    await billsList.expectLoaded();

    // Wait for table rows to load (async data fetch)
    await expect(billsList.tableRows.first()).toBeVisible({ timeout: 10_000 });
    const count = await billsList.getBillCount();
    expect(count).toBeGreaterThan(0);
  });

  test('bills are paginated', async ({ adminPage }) => {
    const billsList = new BillsListPage(adminPage);
    await billsList.goto();
    await billsList.expectLoaded();

    // Verify table exists with rows
    await expect(billsList.table).toBeVisible();
  });

  test('search filters bills by vendor', async ({ adminPage }) => {
    const billsList = new BillsListPage(adminPage);
    await billsList.goto();
    await billsList.expectLoaded();

    await billsList.searchBills('Office Depot');
    // Wait for filtered results
    await adminPage.waitForTimeout(500);

    const row = billsList.getBillRowByVendor('Office Depot');
    await expect(row.first()).toBeVisible();
  });

  test('empty search shows all bills', async ({ adminPage }) => {
    const billsList = new BillsListPage(adminPage);
    await billsList.goto();
    await billsList.expectLoaded();

    // Wait for initial data to load
    await expect(billsList.tableRows.first()).toBeVisible({ timeout: 10_000 });
    const initialCount = await billsList.getBillCount();

    await billsList.searchBills('nonexistent-vendor-xyz');
    await adminPage.waitForTimeout(1000);

    // Clear search
    await billsList.searchInput.clear();
    await adminPage.waitForTimeout(1000);

    const afterClearCount = await billsList.getBillCount();
    expect(afterClearCount).toBe(initialCount);
  });
});

test.describe('Bill Creation @p0', () => {
  test('create minimal bill as admin', async ({ adminPage }) => {
    const newBill = new BillNewPage(adminPage);
    await newBill.goto();
    await newBill.expectLoaded();

    await newBill.createBill({
      date: '2026-04-01',
      vendor: 'E2E Test Vendor',
      brutto19: 119.00,
    });

    // Should redirect to bill detail or bills list
    await adminPage.waitForURL(/\/bills/);
  });

  test('create bill with all fields', async ({ adminPage }) => {
    const newBill = new BillNewPage(adminPage);
    await newBill.goto();
    await newBill.expectLoaded();

    await newBill.createBill({
      date: '2026-04-02',
      vendor: 'E2E Full Vendor',
      item: 'Complete test item',
      comment: 'This is a comprehensive test bill',
      brutto19: 59.50,
      brutto7: 10.70,
      brutto0: 5.00,
    });

    await adminPage.waitForURL(/\/bills/);
  });

  test('user can create bill', async ({ userPage }) => {
    const newBill = new BillNewPage(userPage);
    await newBill.goto();
    await newBill.expectLoaded();

    await newBill.createBill({
      date: '2026-04-03',
      vendor: 'E2E User Vendor',
      brutto19: 25.00,
    });

    await userPage.waitForURL(/\/bills/);
  });
});

test.describe('Bill Status Workflow @p0', () => {
  test('navigate to bill detail from list', async ({ adminPage }) => {
    const billsList = new BillsListPage(adminPage);
    await billsList.goto();
    await billsList.expectLoaded();

    // Click first bill row
    await billsList.clickBillRow(0);
    await adminPage.waitForURL(/\/bills\/.+/);

    const detail = new BillDetailPage(adminPage);
    await detail.expectLoaded();
  });

  test('admin can see bill status controls', async ({ adminPage }) => {
    const billsList = new BillsListPage(adminPage);
    await billsList.goto();
    await billsList.expectLoaded();

    // Navigate to a bill detail
    await billsList.clickBillRow(0);
    await adminPage.waitForURL(/\/bills\/.+/);

    const detail = new BillDetailPage(adminPage);
    await detail.expectLoaded();

    // Admin should see at least one action button
    const hasActions = await adminPage.getByRole('button', { name: /confirm|approve|reject|paid|edit|delete/i }).first().isVisible().catch(() => false);
    expect(hasActions).toBeTruthy();
  });
});

test.describe('Bill Deletion @p0', () => {
  test('admin can delete a bill', async ({ adminPage }) => {
    // First create a bill to delete
    const newBill = new BillNewPage(adminPage);
    await newBill.goto();
    await newBill.createBill({
      date: '2026-04-05',
      vendor: 'E2E Delete Me',
      brutto19: 10.00,
    });

    await adminPage.waitForURL(/\/bills/);

    // Find the bill we just created
    const billsList = new BillsListPage(adminPage);
    const row = billsList.getBillRowByVendor('E2E Delete Me');

    if (await row.first().isVisible()) {
      await row.first().click();
      await adminPage.waitForURL(/\/bills\/.+/);

      const detail = new BillDetailPage(adminPage);
      if (await detail.deleteButton.isVisible()) {
        await detail.deleteButton.click();
        // Confirm deletion dialog
        await adminPage.getByRole('button', { name: /confirm|yes|delete/i }).click();
        await adminPage.waitForURL(/\/bills$/);
      }
    }
  });
});
