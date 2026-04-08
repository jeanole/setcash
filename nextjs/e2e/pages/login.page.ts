import { Page, expect } from '@playwright/test';

export class LoginPage {
  constructor(private page: Page) {}

  // Locators
  get emailInput() { return this.page.locator('input[type="email"]'); }
  get passwordInput() { return this.page.locator('input[type="password"]'); }
  get submitButton() { return this.page.locator('button[type="submit"]'); }
  get errorMessage() { return this.page.locator('[role="alert"], .text-rose-700, .text-red-600').first(); }
  get signUpTab() { return this.page.getByRole('tab', { name: /sign up/i }).or(this.page.getByText(/sign up/i)); }
  get forgotPasswordLink() { return this.page.getByText(/forgot password/i); }
  get demoButton() { return this.page.getByText(/try demo/i).or(this.page.getByText(/demo/i)); }

  async goto() {
    await this.page.goto('/');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async loginAndExpectDashboard(email: string, password: string) {
    await this.login(email, password);
    await this.page.waitForURL('**/dashboard', { timeout: 15_000 });
  }

  async loginAndExpectError(email: string, password: string) {
    await this.login(email, password);
    await expect(this.errorMessage).toBeVisible({ timeout: 10_000 });
  }

  async expectOnLoginPage() {
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
  }
}
