import { Page, expect } from '@playwright/test';

export class NavigationHelper {
  constructor(private page: Page) {}

  // Sidebar links
  get billsLink() { return this.page.locator('a[href="/bills"]').first(); }
  get budgetLink() { return this.page.locator('a[href="/budget"]').first(); }
  get spendingLink() { return this.page.locator('a[href="/spending"]').first(); }
  get reportsLink() { return this.page.locator('a[href="/reports"]').first(); }
  get vgeldLink() { return this.page.locator('a[href="/vgeld"]').first(); }
  get settingsLink() { return this.page.locator('a[href="/settings"]').first(); }
  get dashboardLink() { return this.page.locator('a[href="/dashboard"]').first(); }

  // Header
  get mobileMenuButton() { return this.page.locator('button[aria-label*="navigation"], button[aria-label*="menu"]').first(); }
  get uploadButton() { return this.page.locator('a[aria-label*="Upload new bill"], a[href="/bills/new"]').first(); }
  get profileButton() { return this.page.locator('button[aria-label*="profile"], button[aria-label*="signed in"]').first(); }
  get notificationBell() { return this.page.locator('button[aria-label*="notification"], [data-notifications]').first(); }
  get superAdminButton() { return this.page.locator('button[aria-label*="Super Admin"]'); }

  // Theme
  get themeToggle() { return this.page.locator('button[aria-label*="theme"], button[aria-label*="dark"], button[aria-label*="light"]').first(); }

  async navigateTo(section: 'bills' | 'budget' | 'spending' | 'reports' | 'vgeld' | 'settings' | 'dashboard') {
    const links = {
      bills: this.billsLink,
      budget: this.budgetLink,
      spending: this.spendingLink,
      reports: this.reportsLink,
      vgeld: this.vgeldLink,
      settings: this.settingsLink,
      dashboard: this.dashboardLink,
    };
    await links[section].click();
    await this.page.waitForURL(`**/${section}`);
  }

  async openMobileMenu() {
    await this.mobileMenuButton.click();
  }

  async expectNavItemVisible(name: string) {
    await expect(this.page.locator(`a[href*="${name}"]`).first()).toBeVisible();
  }

  async expectNavItemHidden(name: string) {
    await expect(this.page.locator(`a[href*="${name}"]`).first()).not.toBeVisible();
  }
}
