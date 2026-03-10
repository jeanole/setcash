"use strict";
// ============================================================================
// Utility Functions
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.ocrStatusDisplay = exports.statusColors = void 0;
exports.formatCurrency = formatCurrency;
exports.formatDate = formatDate;
exports.formatDateForInput = formatDateForInput;
exports.escapeHtml = escapeHtml;
exports.calculateNetto = calculateNetto;
exports.calculateTotal = calculateTotal;
exports.parseNum = parseNum;
exports.formatAllocations = formatAllocations;
exports.calculateBillNumber = calculateBillNumber;
exports.debounce = debounce;
exports.cn = cn;
/**
 * Format a number as currency (EUR)
 */
function formatCurrency(amount) {
    if (amount === null || amount === undefined || isNaN(amount))
        return '-';
    return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
    }).format(amount);
}
/**
 * Format a date string to display format
 */
function formatDate(dateStr) {
    if (!dateStr)
        return '-';
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    }
    catch (_a) {
        return dateStr;
    }
}
/**
 * Format date for input[type="date"]
 */
function formatDateForInput(dateStr) {
    if (!dateStr)
        return '';
    try {
        const date = new Date(dateStr);
        return date.toISOString().split('T')[0];
    }
    catch (_a) {
        return '';
    }
}
/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
    if (!text)
        return '';
    const div = typeof document !== 'undefined' ? document.createElement('div') : null;
    if (div) {
        div.textContent = text;
        return div.innerHTML;
    }
    // Server-side fallback
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
/**
 * Calculate netto amount from brutto amounts
 */
function calculateNetto(brutto19, brutto7, brutto0) {
    return (brutto19 || 0) / 1.19 + (brutto7 || 0) / 1.07 + (brutto0 || 0);
}
/**
 * Calculate total brutto amount
 */
function calculateTotal(brutto19, brutto7, brutto0) {
    return (brutto19 || 0) + (brutto7 || 0) + (brutto0 || 0);
}
/**
 * Parse a number from form input
 */
function parseNum(value) {
    if (typeof value === 'number')
        return value;
    if (!value)
        return 0;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
}
/**
 * Format allocation display string
 */
function formatAllocations(allocations) {
    if (!allocations || allocations.length === 0)
        return '';
    return allocations
        .map((a) => `${a.name} ${Math.round(a.percentage)}%`)
        .join(', ');
}
/**
 * Calculate bill number for new bill
 * Format: group.position (e.g., 1.01, 1.20, 2.01)
 */
function calculateBillNumber(existingCount) {
    const group = Math.floor(existingCount / 20) + 1;
    const position = (existingCount % 20) + 1;
    return `${group}.${position.toString().padStart(2, '0')}`;
}
/**
 * Status badge colors mapping
 */
exports.statusColors = {
    confirmed: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
    pending: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    approved: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    rejected: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
    paid: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    draft: { bg: 'bg-rose-500', text: 'text-white', border: 'border-rose-500' },
};
/**
 * OCR status display mapping
 */
exports.ocrStatusDisplay = {
    pending: { label: 'Analysing...', color: 'text-[#7C6AF6]' },
    done: { label: 'AI - check', color: 'text-amber-600' },
    failed: { label: 'Failed', color: 'text-rose-600' },
};
/**
 * Debounce function
 */
function debounce(fn, delay) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}
/**
 * Class name merger for Tailwind
 */
function cn(...classes) {
    return classes.filter(Boolean).join(' ');
}
