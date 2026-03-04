// ============================================================================
// Bills API Client
// ============================================================================

import { Bill, EditLog, Motive, Category } from '@/lib/types';

const API_BASE = '/api';

async function fetchWithError<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  
  return response.json();
}

// Get all bills
export async function getBills(): Promise<Bill[]> {
  return fetchWithError<Bill[]>(`${API_BASE}/bills`);
}

// Get a single bill
export async function getBill(id: string): Promise<Bill> {
  return fetchWithError<Bill>(`${API_BASE}/bills/${id}`);
}

// Create a new bill
export async function createBill(data: FormData): Promise<{ ok: true; id: string }> {
  return fetchWithError(`${API_BASE}/bills`, {
    method: 'POST',
    body: data,
  });
}

// Update a bill
export async function updateBill(
  id: string,
  data: Record<string, unknown>
): Promise<{ ok: true }> {
  return fetchWithError(`${API_BASE}/bills/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

// Delete a bill
export async function deleteBill(id: string): Promise<{ ok: true }> {
  return fetchWithError(`${API_BASE}/bills/${id}`, {
    method: 'DELETE',
  });
}

// Bulk delete bills
export async function bulkDeleteBill(ids: string[]): Promise<{ ok: true; deleted: number }> {
  return fetchWithError(`${API_BASE}/bills/bulk-delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
}

// Get edit logs
export async function getEditLogs(): Promise<EditLog[]> {
  return fetchWithError<EditLog[]>(`${API_BASE}/bills/log`);
}

// Get motives for current project
export async function getMotives(): Promise<Motive[]> {
  return fetchWithError<Motive[]>(`${API_BASE}/motives`);
}

// Get categories for current project
export async function getCategories(): Promise<Category[]> {
  return fetchWithError<Category[]>(`${API_BASE}/categories`);
}

// Trigger OCR analysis
export async function analyseBill(id: string): Promise<{ ok: true }> {
  return fetchWithError(`${API_BASE}/bills/${id}/analyse`, {
    method: 'POST',
  });
}

// Get OCR status
export async function getOcrStatus(id: string): Promise<{
  ocrStatus: string;
  ocrFields: string[] | null;
}> {
  return fetchWithError(`${API_BASE}/bills/${id}/ocr-status`);
}

// Verify an OCR field
export async function verifyOcrField(
  id: string,
  field: string
): Promise<{ ok: true; ocrFields: string[] | null; ocrStatus: string | null }> {
  return fetchWithError(`${API_BASE}/bills/${id}/verify-field`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ field }),
  });
}

// Upload images to bill
export async function uploadImages(
  billId: string,
  files: File[]
): Promise<{ ok: true; images: { id: string; filename: string; file: string }[] }> {
  const formData = new FormData();
  files.forEach((file) => formData.append('photos', file));
  
  return fetchWithError(`${API_BASE}/bills/${billId}/images`, {
    method: 'POST',
    body: formData,
  });
}

// Delete an image
export async function deleteImage(billId: string, imageId: string): Promise<{ ok: true }> {
  return fetchWithError(`${API_BASE}/bills/${billId}/images/${imageId}`, {
    method: 'DELETE',
  });
}

// Replace/crop an image
export async function replaceImage(
  billId: string,
  imageId: string,
  file: File
): Promise<{ ok: true }> {
  const formData = new FormData();
  formData.append('photo', file);
  
  return fetchWithError(`${API_BASE}/bills/${billId}/images/${imageId}`, {
    method: 'PUT',
    body: formData,
  });
}

// Reorder images
export async function reorderImages(
  billId: string,
  images: { id: string; sortOrder: number }[]
): Promise<{ ok: true }> {
  return fetchWithError(`${API_BASE}/bills/${billId}/images/reorder`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images }),
  });
}

// Update bill status
export async function updateBillStatus(
  id: string,
  status: string
): Promise<{ ok: true }> {
  return fetchWithError(`${API_BASE}/bills/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
}
