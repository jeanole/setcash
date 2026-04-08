import { Page, expect } from '@playwright/test';

export class BillNewPage {
  constructor(private page: Page) {}

  // Form fields
  get dateInput() { return this.page.locator('input[type="date"]').first(); }
  get typeSelect() { return this.page.locator('select').filter({ hasText: /kauf|rechnung|type/i }).first(); }
  get vendorInput() { return this.page.locator('input[placeholder="Store or company name"]'); }
  get itemInput() { return this.page.locator('input[placeholder="What was purchased"]'); }
  get commentInput() { return this.page.locator('textarea').first(); }
  get brutto19Input() { return this.page.locator('input[type="number"]').nth(0); }
  get brutto7Input() { return this.page.locator('input[type="number"]').nth(1); }
  get brutto0Input() { return this.page.locator('input[type="number"]').nth(2); }
  get submitButton() { return this.page.locator('button[type="submit"]'); }
  get cancelButton() { return this.page.getByRole('button', { name: /cancel/i }); }
  get fileInput() { return this.page.getByLabel('Upload images'); }

  async goto() {
    await this.page.goto('/bills/new');
  }

  async expectLoaded() {
    await this.page.waitForURL('**/bills/new');
    await expect(this.dateInput).toBeVisible({ timeout: 10_000 });
  }

  async fillBill(data: {
    date?: string;
    vendor: string;
    item?: string;
    comment?: string;
    brutto19?: number;
    brutto7?: number;
    brutto0?: number;
    type?: string;
  }) {
    if (data.date) await this.dateInput.fill(data.date);
    await this.vendorInput.fill(data.vendor);
    if (data.item) await this.itemInput.fill(data.item);
    if (data.comment) await this.commentInput.fill(data.comment);
    if (data.brutto19 !== undefined) {
      await this.brutto19Input.clear();
      await this.brutto19Input.fill(String(data.brutto19));
    }
    if (data.brutto7 !== undefined) {
      await this.brutto7Input.clear();
      await this.brutto7Input.fill(String(data.brutto7));
    }
    if (data.brutto0 !== undefined) {
      await this.brutto0Input.clear();
      await this.brutto0Input.fill(String(data.brutto0));
    }
  }

  async submit() {
    await this.submitButton.click();
  }

  async createBill(data: Parameters<BillNewPage['fillBill']>[0]) {
    await this.fillBill(data);
    await this.submit();
  }
}
