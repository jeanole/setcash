"use strict";
// ============================================================================
// Bills API Client
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBills = getBills;
exports.getBill = getBill;
exports.createBill = createBill;
exports.updateBill = updateBill;
exports.deleteBill = deleteBill;
exports.bulkDeleteBill = bulkDeleteBill;
exports.getEditLogs = getEditLogs;
exports.getMotives = getMotives;
exports.getCategories = getCategories;
exports.analyseBill = analyseBill;
exports.getOcrStatus = getOcrStatus;
exports.verifyOcrField = verifyOcrField;
exports.uploadImages = uploadImages;
exports.deleteImage = deleteImage;
exports.replaceImage = replaceImage;
exports.reorderImages = reorderImages;
exports.updateBillStatus = updateBillStatus;
const API_BASE = '/api';
async function fetchWithError(url, options) {
    const response = await fetch(url, options);
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }
    return response.json();
}
// Get all bills
async function getBills() {
    return fetchWithError(`${API_BASE}/bills`);
}
// Get a single bill
async function getBill(id) {
    return fetchWithError(`${API_BASE}/bills/${id}`);
}
// Create a new bill
async function createBill(data) {
    return fetchWithError(`${API_BASE}/bills`, {
        method: 'POST',
        body: data,
    });
}
// Update a bill
async function updateBill(id, data) {
    return fetchWithError(`${API_BASE}/bills/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}
// Delete a bill
async function deleteBill(id) {
    return fetchWithError(`${API_BASE}/bills/${id}`, {
        method: 'DELETE',
    });
}
// Bulk delete bills
async function bulkDeleteBill(ids) {
    return fetchWithError(`${API_BASE}/bills/bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
    });
}
// Get edit logs
async function getEditLogs() {
    return fetchWithError(`${API_BASE}/bills/log`);
}
// Get motives for current project
async function getMotives() {
    return fetchWithError(`${API_BASE}/motives`);
}
// Get categories for current project
async function getCategories() {
    return fetchWithError(`${API_BASE}/categories`);
}
// Trigger OCR analysis
async function analyseBill(id) {
    return fetchWithError(`${API_BASE}/bills/${id}/analyse`, {
        method: 'POST',
    });
}
// Get OCR status
async function getOcrStatus(id) {
    return fetchWithError(`${API_BASE}/bills/${id}/ocr-status`);
}
// Verify an OCR field
async function verifyOcrField(id, field) {
    return fetchWithError(`${API_BASE}/bills/${id}/verify-field`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field }),
    });
}
// Upload images to bill
async function uploadImages(billId, files) {
    const formData = new FormData();
    files.forEach((file) => formData.append('photos', file));
    return fetchWithError(`${API_BASE}/bills/${billId}/images`, {
        method: 'POST',
        body: formData,
    });
}
// Delete an image
async function deleteImage(billId, imageId) {
    return fetchWithError(`${API_BASE}/bills/${billId}/images/${imageId}`, {
        method: 'DELETE',
    });
}
// Replace/crop an image
async function replaceImage(billId, imageId, file) {
    const formData = new FormData();
    formData.append('photo', file);
    return fetchWithError(`${API_BASE}/bills/${billId}/images/${imageId}`, {
        method: 'PUT',
        body: formData,
    });
}
// Reorder images
async function reorderImages(billId, images) {
    return fetchWithError(`${API_BASE}/bills/${billId}/images/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images }),
    });
}
// Update bill status
async function updateBillStatus(id, status) {
    return fetchWithError(`${API_BASE}/bills/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
    });
}
