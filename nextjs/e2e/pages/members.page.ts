import { Page, expect } from '@playwright/test';

export class MembersPage {
  constructor(private page: Page) {}

  get heading() { return this.page.getByRole('heading', { name: /member/i }).first(); }
  get inviteButton() { return this.page.locator('main').getByRole('button', { name: /invite member/i }); }
  get membersTable() { return this.page.locator('table').first(); }
  get memberRows() { return this.membersTable.locator('tbody tr'); }

  // Invite modal
  get inviteEmailInput() { return this.page.locator('input#invite-email').or(this.page.locator('input[type="email"]').last()); }
  get inviteMessageInput() { return this.page.locator('textarea#invite-message').or(this.page.locator('textarea').last()); }
  get inviteSendButton() { return this.page.getByRole('button', { name: /send|invite/i }).last(); }
  get modalClose() { return this.page.locator('button[aria-label="Close"]'); }

  async goto() {
    await this.page.goto('/settings/members');
  }

  async expectLoaded() {
    await this.page.waitForURL('**/settings/members');
    await expect(
      this.page.locator('main').getByRole('heading', { name: /member/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  }

  async getMemberCount() {
    return this.memberRows.count();
  }

  async inviteMember(email: string, message?: string) {
    await this.inviteButton.click();
    await this.inviteEmailInput.fill(email);
    if (message) await this.inviteMessageInput.fill(message);
    await this.inviteSendButton.click();
  }

  getMemberRowByEmail(email: string) {
    return this.memberRows.filter({ hasText: email });
  }

  async changeRole(email: string, newRole: string) {
    const row = this.getMemberRowByEmail(email);
    const select = row.locator('select').first();
    await select.selectOption(newRole);
  }

  async removeMember(email: string) {
    const row = this.getMemberRowByEmail(email);
    await row.getByRole('button', { name: /remove|delete/i }).click();
    // Confirm deletion
    await this.page.getByRole('button', { name: /confirm|yes|delete/i }).click();
  }
}
