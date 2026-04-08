import { Page, expect, Locator } from '@playwright/test';

export class BillsListPage {
  constructor(private page: Page) {}

  get heading() { return this.page.getByRole('heading', { name: /bills/i }).first(); }
  get newBillButton() { return this.page.getByRole('link', { name: /upload new bill|new bill/i }).or(this.page.getByText(/upload new bill/i)); }
  get table() { return this.page.locator('table').first(); }
  get tableRows() { return this.table.locator('tbody tr'); }
  get searchInput() { return this.page.locator('input[placeholder*="endor"]').or(this.page.locator('input[placeholder*="earch"]')); }
  get statusFilter() { return this.page.locator('select').filter({ hasText: /status|all/i }).first(); }
  get selectAllCheckbox() { return this.table.locator('thead input[type="checkbox"]'); }
  get bulkDeleteButton() { return this.page.getByRole('button', { name: /delete/i }); }
  get emptyState() { return this.page.getByText(/no bills/i); }
  get paginationNext() { return this.page.getByRole('button', { name: /next/i }).or(this.page.locator('button:has-text(">")')); }
  get paginationPrev() { return this.page.getByRole('button', { name: /prev/i }).or(this.page.locator('button:has-text("<")')); }

  async goto() {
    await this.page.goto('/bills');
  }

  async expectLoaded() {
    await this.page.waitForURL('**/bills');
    await expect(this.heading).toBeVisible({ timeout: 10_000 });
  }

  async getBillCount() {
    return this.tableRows.count();
  }

  async clickBillRow(index: number) {
    await this.tableRows.nth(index).click();
  }

  async filterByStatus(status: string) {
    // Click status filter tab/button
    await this.page.getByRole('button', { name: new RegExp(status, 'i') })
      .or(this.page.getByText(new RegExp(`^${status}$`, 'i')))
      .first()
      .click();
  }

  async searchBills(query: string) {
    await this.searchInput.fill(query);
    // Wait for debounce
    await this.page.waitForTimeout(500);
  }

  getBillRowByVendor(vendor: string): Locator {
    return this.tableRows.filter({ hasText: vendor });
  }
}
