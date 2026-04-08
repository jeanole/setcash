import { Page, expect } from '@playwright/test';

export class ProfilePage {
  constructor(private page: Page) {}

  get firstNameInput() { return this.page.locator('input[name="firstName"], label:has-text("First") + input, input[placeholder*="irst"]').first(); }
  get lastNameInput() { return this.page.locator('input[name="lastName"], label:has-text("Last") + input, input[placeholder*="ast"]').first(); }
  get saveButton() { return this.page.getByRole('button', { name: /save/i }); }
  get currentPasswordInput() { return this.page.locator('input[type="password"]').nth(0); }
  get newPasswordInput() { return this.page.locator('input[type="password"]').nth(1); }
  get confirmPasswordInput() { return this.page.locator('input[type="password"]').nth(2); }
  get changePasswordButton() { return this.page.getByRole('button', { name: /change password|update password/i }); }

  async goto() {
    // Profile may be a modal or route — try both
    await this.page.goto('/settings');
    // Click profile button in header
    await this.page.locator('button[aria-label*="profile"], button[aria-label*="signed in"]').first().click().catch(() => {});
  }

  async updateName(firstName: string, lastName: string) {
    await this.firstNameInput.clear();
    await this.firstNameInput.fill(firstName);
    await this.lastNameInput.clear();
    await this.lastNameInput.fill(lastName);
    await this.saveButton.click();
  }

  async changePassword(current: string, newPass: string) {
    await this.currentPasswordInput.fill(current);
    await this.newPasswordInput.fill(newPass);
    if (await this.confirmPasswordInput.count() > 0) {
      await this.confirmPasswordInput.fill(newPass);
    }
    await this.changePasswordButton.click();
  }
}
