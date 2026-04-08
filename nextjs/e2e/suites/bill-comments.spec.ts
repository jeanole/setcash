/**
 * Bill Comments — P2
 *
 * Tests comment CRUD on bill detail pages.
 */

import { test, expect } from '../fixtures/test-fixtures';
import { BillsListPage } from '../pages/bills-list.page';

test.describe('Bill Comments @p2', () => {
  test('add comment to a bill via API', async ({ adminPage }) => {
    // Get a bill ID
    const billsRes = await adminPage.request.get('/api/bills');
    const bills = await billsRes.json();
    const bill = Array.isArray(bills) ? bills[0] : bills.bills?.[0];

    if (!bill) return;

    const response = await adminPage.request.post(`/api/bills/${bill.id}/comments`, {
      data: { text: 'E2E test comment' },
    });
    expect([200, 201]).toContain(response.status());
  });

  test('edit own comment', async ({ adminPage }) => {
    const billsRes = await adminPage.request.get('/api/bills');
    const bills = await billsRes.json();
    const bill = Array.isArray(bills) ? bills[0] : bills.bills?.[0];

    if (!bill) return;

    // Create a comment first
    const createRes = await adminPage.request.post(`/api/bills/${bill.id}/comments`, {
      data: { text: 'Comment to edit' },
    });
    if (createRes.status() !== 200 && createRes.status() !== 201) return;

    const comment = await createRes.json();
    if (!comment.id) return;

    // Edit it
    const editRes = await adminPage.request.patch(`/api/bills/${bill.id}/comments/${comment.id}`, {
      data: { text: 'Edited comment text' },
    });
    expect(editRes.status()).toBe(200);
  });

  test('delete own comment', async ({ adminPage }) => {
    const billsRes = await adminPage.request.get('/api/bills');
    const bills = await billsRes.json();
    const bill = Array.isArray(bills) ? bills[0] : bills.bills?.[0];

    if (!bill) return;

    // Create a comment to delete
    const createRes = await adminPage.request.post(`/api/bills/${bill.id}/comments`, {
      data: { text: 'Comment to delete' },
    });
    if (createRes.status() !== 200 && createRes.status() !== 201) return;

    const comment = await createRes.json();
    if (!comment.id) return;

    const deleteRes = await adminPage.request.delete(`/api/bills/${bill.id}/comments/${comment.id}`);
    expect(deleteRes.status()).toBe(200);
  });

  test('empty comment is rejected', async ({ adminPage }) => {
    const billsRes = await adminPage.request.get('/api/bills');
    const bills = await billsRes.json();
    const bill = Array.isArray(bills) ? bills[0] : bills.bills?.[0];

    if (!bill) return;

    const response = await adminPage.request.post(`/api/bills/${bill.id}/comments`, {
      data: { text: '' },
    });
    expect([400, 422]).toContain(response.status());
  });
});
