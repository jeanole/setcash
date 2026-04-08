import { Page, expect } from '@playwright/test';

export class SettingsPage {
  constructor(private page: Page) {}

  async goto(section?: string) {
    const path = section ? `/settings/${section}` : '/settings';
    await this.page.goto(path);
  }

  async expectLoaded() {
    await expect(this.page.getByText(/settings/i).first()).toBeVisible({ timeout: 10_000 });
  }
}

export class CategoriesPage {
  constructor(private page: Page) {}

  get addButton() { return this.page.getByRole('button', { name: /add|create|new/i }); }
  get nameInput() { return this.page.locator('input[placeholder*="name"], input[type="text"]').first(); }
  get budgetInput() { return this.page.locator('input[type="number"]').first(); }
  get saveButton() { return this.page.getByRole('button', { name: /save|add|create/i }); }
  get items() { return this.page.locator('table tbody tr, [data-item]'); }

  async goto() {
    await this.page.goto('/settings/categories');
  }

  async expectLoaded() {
    await this.page.waitForURL('**/settings/categories');
    await expect(this.page.getByText(/categor/i).first()).toBeVisible({ timeout: 10_000 });
  }

  async addCategory(name: string, budget: number) {
    await this.addButton.click();
    await this.nameInput.fill(name);
    await this.budgetInput.fill(String(budget));
    await this.saveButton.click();
  }

  async getItemCount() {
    return this.items.count();
  }
}

export class MotivesPage {
  constructor(private page: Page) {}

  get addButton() { return this.page.getByRole('button', { name: /add|create|new/i }); }
  get nameInput() { return this.page.locator('input[placeholder*="name"], input[type="text"]').first(); }
  get budgetInput() { return this.page.locator('input[type="number"]').first(); }
  get saveButton() { return this.page.getByRole('button', { name: /save|add|create/i }); }
  get items() { return this.page.locator('table tbody tr, [data-item]'); }

  async goto() {
    await this.page.goto('/settings/motives');
  }

  async expectLoaded() {
    await this.page.waitForURL('**/settings/motives');
    await expect(this.page.getByText(/motive/i).first()).toBeVisible({ timeout: 10_000 });
  }

  async addMotive(name: string, budget: number) {
    await this.addButton.click();
    await this.nameInput.fill(name);
    await this.budgetInput.fill(String(budget));
    await this.saveButton.click();
  }
}
