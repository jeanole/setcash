import { Page, expect } from '@playwright/test';

export class BillDetailPage {
  constructor(private page: Page) {}

  get statusBadge() { return this.page.locator('[class*="badge"], [class*="status"]').first(); }
  get editButton() { return this.page.getByRole('button', { name: /edit/i }); }
  get deleteButton() { return this.page.getByRole('button', { name: /delete/i }); }
  get confirmButton() { return this.page.getByRole('button', { name: /confirm/i }); }
  get approveButton() { return this.page.getByRole('button', { name: /approve/i }); }
  get rejectButton() { return this.page.getByRole('button', { name: /reject/i }); }
  get paidButton() { return this.page.getByRole('button', { name: /paid/i }); }
  get revertButton() { return this.page.getByRole('button', { name: /revert|draft/i }); }
  get analyseButton() { return this.page.getByRole('button', { name: /analy/i }); }
  get imageGallery() { return this.page.locator('img[alt*="bill"], img[alt*="image"], img[alt*="receipt"]').first(); }
  get commentInput() { return this.page.locator('textarea[placeholder*="comment"], textarea[placeholder*="Comment"]'); }
  get commentSubmit() { return this.page.getByRole('button', { name: /add comment|post|send/i }); }
  get comments() { return this.page.locator('[data-comment], [class*="comment"]'); }
  get vendorText() { return this.page.getByText(/vendor|store/i).first(); }
  get amountText() { return this.page.locator('[class*="amount"], [data-field="amount"]').first(); }

  async goto(billId: string) {
    await this.page.goto(`/bills/${billId}`);
  }

  async expectLoaded() {
    await expect(this.page.getByText(/vendor|date|amount|status/i).first()).toBeVisible({ timeout: 10_000 });
  }

  async getStatus(): Promise<string> {
    const text = await this.statusBadge.textContent();
    return (text ?? '').trim().toLowerCase();
  }

  async changeStatus(action: 'confirm' | 'approve' | 'reject' | 'paid' | 'revert') {
    const buttons = {
      confirm: this.confirmButton,
      approve: this.approveButton,
      reject: this.rejectButton,
      paid: this.paidButton,
      revert: this.revertButton,
    };
    await buttons[action].click();
    // Wait for status update (may show confirmation dialog)
    await this.page.waitForTimeout(1000);
  }

  async addComment(text: string) {
    await this.commentInput.fill(text);
    await this.commentSubmit.click();
  }
}
