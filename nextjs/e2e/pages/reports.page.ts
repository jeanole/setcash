import { Page, expect } from '@playwright/test';

export class ReportsPage {
  constructor(private page: Page) {}

  get heading() { return this.page.getByRole('heading', { name: /report/i }).first(); }
  get pdfExportButton() { return this.page.getByRole('button', { name: /pdf/i }).or(this.page.getByRole('link', { name: /pdf/i })); }
  get excelExportButton() { return this.page.getByRole('button', { name: /excel/i }).or(this.page.getByRole('link', { name: /excel/i })); }
  get sheetsExportButton() { return this.page.getByRole('button', { name: /sheets|google/i }).or(this.page.getByRole('link', { name: /sheets/i })); }

  async goto() {
    await this.page.goto('/reports');
  }

  async expectLoaded() {
    await this.page.waitForURL('**/reports');
    await expect(
      this.page.locator('main').getByRole('heading', { name: /report/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  }
}
