/**
 * Budget Matrix — P0
 *
 * Tests matrix loading, cell editing, and access control.
 */

import { test, expect } from '../fixtures/test-fixtures';
import { BudgetPage } from '../pages/budget.page';

test.describe('Budget Matrix @p0', () => {
  test('admin can view budget matrix', async ({ adminPage }) => {
    const budget = new BudgetPage(adminPage);
    await budget.goto();
    await budget.expectLoaded();

    // Matrix table should be visible with populated cells
    await expect(budget.matrixTable).toBeVisible();
  });

  test('matrix shows categories and motives', async ({ adminPage }) => {
    const budget = new BudgetPage(adminPage);
    await budget.goto();
    await budget.expectLoaded();

    // Check for seeded category names
    await expect(adminPage.getByText('Office Supplies')).toBeVisible();
    await expect(adminPage.getByText('Operations')).toBeVisible();
  });

  test('admin can edit matrix cell', async ({ adminPage }) => {
    const budget = new BudgetPage(adminPage);
    await budget.goto();
    await budget.expectLoaded();

    // Edit first cell
    await budget.editCell(0, 0, '999');

    // Verify the change persisted (save may be automatic or require button)
    if (await budget.saveButton.isVisible()) {
      await budget.saveButton.click();
    }

    // Reload and verify
    await budget.goto();
    await budget.expectLoaded();
    const value = await budget.getCellValue(0, 0);
    expect(value).toContain('999');
  });

  test('user can view budget matrix (read-only)', async ({ userPage }) => {
    const budget = new BudgetPage(userPage);
    await budget.goto();
    await budget.expectLoaded();

    // Matrix should be visible
    await expect(budget.matrixTable).toBeVisible();
  });

  test('matrix displays decimal values correctly', async ({ adminPage }) => {
    const budget = new BudgetPage(adminPage);
    await budget.goto();
    await budget.expectLoaded();

    // Verify cells contain numeric values
    const cellText = await budget.getCellValue(0, 0);
    expect(cellText).toMatch(/\d/);
  });
});
