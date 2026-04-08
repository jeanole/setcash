import { Page, expect } from '@playwright/test';

export class VgeldPage {
  constructor(private page: Page) {}

  get heading() { return this.page.getByRole('heading', { name: /v-geld|vgeld/i }).first(); }
  get createButton() { return this.page.getByRole('button', { name: /add v-geld transfer/i }); }
  get transferRows() { return this.page.locator('table[aria-label="V-Geld transfers"] tbody tr').filter({ hasNot: this.page.locator('text=No V-Geld transfers') }); }
  get amountInput() { return this.page.locator('input[type="number"]').first(); }
  get recipientSelect() { return this.page.locator('select').first(); }
  get submitButton() { return this.page.getByRole('button', { name: /add transfer|save|submit/i }); }

  async goto() {
    await this.page.goto('/vgeld');
  }

  async expectLoaded() {
    await this.page.waitForURL('**/vgeld');
    await expect(
      this.page.locator('main').getByRole('heading', { name: /v-geld|vgeld/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  }

  async createTransfer(amount: number, recipient?: string) {
    await this.createButton.click();
    await this.amountInput.fill(String(amount));
    if (recipient) await this.recipientSelect.selectOption({ label: recipient });
    await this.submitButton.click();
  }

  async getTransferCount() {
    return this.transferRows.count();
  }
}
