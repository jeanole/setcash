import { Page, expect } from '@playwright/test';

export class SuperAdminPage {
  constructor(private page: Page) {}

  // User management
  get usersTab() { return this.page.getByRole('tab', { name: /user/i }).or(this.page.getByText(/users/i).first()); }
  get projectsTab() { return this.page.getByRole('tab', { name: /project/i }).or(this.page.getByText(/projects/i).first()); }
  get configTab() { return this.page.getByRole('tab', { name: /config|system/i }).or(this.page.getByText(/config/i).first()); }
  get createUserButton() { return this.page.getByRole('button', { name: /create user|add user|new user/i }); }
  get userRows() { return this.page.locator('table tbody tr'); }
  get projectRows() { return this.page.locator('table tbody tr'); }

  // Create user modal
  get emailInput() { return this.page.locator('input[type="email"]').last(); }
  get nameInput() { return this.page.locator('input[type="text"]').last(); }
  get submitButton() { return this.page.getByRole('button', { name: /create|save/i }).last(); }

  async goto() {
    // Superadmin panel — may be a route or triggered by button
    await this.page.locator('button[aria-label*="Super Admin"]').click().catch(async () => {
      await this.page.goto('/admin');
    });
  }

  async expectLoaded() {
    await expect(this.page.getByText(/admin|system|manage/i).first()).toBeVisible({ timeout: 10_000 });
  }

  async createUser(email: string, name?: string) {
    await this.createUserButton.click();
    await this.emailInput.fill(email);
    if (name) await this.nameInput.fill(name);
    await this.submitButton.click();
  }

  getUserRowByEmail(email: string) {
    return this.userRows.filter({ hasText: email });
  }
}
