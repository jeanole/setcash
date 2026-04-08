import { Page, expect } from '@playwright/test';

export class DashboardPage {
  constructor(private page: Page) {}

  get heading() { return this.page.getByRole('heading', { level: 1 }); }
  get metricsSection() { return this.page.locator('section[aria-label="Key metrics"]').or(this.page.locator('[data-section="metrics"]')); }
  get recentBills() { return this.page.locator('section[aria-label*="ecent"]').or(this.page.getByText(/recent/i).first()); }
  get chartsSection() { return this.page.locator('section[aria-label*="chart"]').or(this.page.locator('[data-section="charts"]')); }

  async goto() {
    await this.page.goto('/dashboard');
  }

  async expectLoaded() {
    await this.page.waitForURL('**/dashboard');
    // Wait for any KPI card or heading to appear
    await expect(
      this.page.getByText(/budget|pending|bills|balance/i).first()
    ).toBeVisible({ timeout: 10_000 });
  }

  async getKpiValues() {
    // Return visible text from the metrics area
    const metricsText = await this.page.locator('main').first().textContent();
    return metricsText;
  }
}
