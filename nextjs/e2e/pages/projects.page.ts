import { Page, expect } from '@playwright/test';

export class ProjectsPage {
  constructor(private page: Page) {}

  get heading() { return this.page.getByRole('heading', { name: /project/i }).first(); }
  get createButton() { return this.page.getByRole('button', { name: /create|new/i }); }
  get nameInput() { return this.page.locator('input[placeholder*="name"], input[type="text"]').first(); }
  get subtitleInput() { return this.page.locator('input[placeholder*="subtitle"]').or(this.page.locator('input[type="text"]').nth(1)); }
  get saveButton() { return this.page.getByRole('button', { name: /save|create/i }); }
  get projectList() { return this.page.locator('table tbody tr, [data-project]'); }

  async goto() {
    await this.page.goto('/settings/projects');
  }

  async expectLoaded() {
    await this.page.waitForURL('**/settings/projects');
    await expect(
      this.page.locator('main').getByRole('heading', { name: /project/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  }

  async createProject(name: string, subtitle?: string) {
    await this.createButton.click();
    await this.nameInput.fill(name);
    if (subtitle) await this.subtitleInput.fill(subtitle);
    await this.saveButton.click();
  }
}

export class ProjectSwitcher {
  constructor(private page: Page) {}

  get trigger() { return this.page.locator('button[aria-label="Switch project"]').or(this.page.locator('[data-project-switcher]')); }
  get dropdown() { return this.page.locator('[role="listbox"]').or(this.page.locator('[data-project-dropdown]')); }

  async open() {
    await this.trigger.click();
    await expect(this.dropdown).toBeVisible();
  }

  async switchTo(projectName: string) {
    await this.open();
    await this.page.getByRole('option', { name: projectName }).click();
    // Wait for session update
    await this.page.waitForTimeout(1000);
  }

  async getCurrentProject(): Promise<string> {
    return (await this.trigger.textContent()) ?? '';
  }
}
