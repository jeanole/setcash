import { Page, expect } from '@playwright/test';

export class SpendingPage {
  constructor(private page: Page) {}

  get heading() { return this.page.getByRole('heading', { name: /spending/i }).first(); }

  async goto() {
    await this.page.goto('/spending');
  }

  async expectLoaded() {
    await this.page.waitForURL('**/spending');
    await expect(
      this.page.locator('main').getByRole('heading', { name: /spending/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  }
}
