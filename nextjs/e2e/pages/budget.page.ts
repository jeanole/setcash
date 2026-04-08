import { Page, expect } from '@playwright/test';

export class BudgetPage {
  constructor(private page: Page) {}

  get heading() { return this.page.getByRole('heading', { name: /budget/i }).first(); }
  get matrixTable() { return this.page.locator('table').first(); }
  get cells() { return this.matrixTable.locator('td input[type="number"], td [contenteditable]'); }
  get saveButton() { return this.page.getByRole('button', { name: /save/i }); }
  get modeToggle() { return this.page.getByRole('button', { name: /brutto|netto/i }).first(); }

  async goto() {
    await this.page.goto('/budget');
  }

  async expectLoaded() {
    await this.page.waitForURL('**/budget');
    await expect(
      this.page.getByRole('heading', { name: 'Budget Matrix' })
    ).toBeVisible({ timeout: 10_000 });
  }

  async getCellValue(row: number, col: number): Promise<string> {
    const cell = this.matrixTable.locator('tbody tr').nth(row).locator('td').nth(col + 1);
    const input = cell.locator('input');
    if (await input.count() > 0) {
      return (await input.inputValue()) ?? '';
    }
    return (await cell.textContent()) ?? '';
  }

  async editCell(row: number, col: number, value: string) {
    const cell = this.matrixTable.locator('tbody tr').nth(row).locator('td').nth(col + 1);
    await cell.click();
    const input = cell.locator('input');
    await input.clear();
    await input.fill(value);
    // Tab or blur to trigger save
    await input.press('Tab');
  }
}
