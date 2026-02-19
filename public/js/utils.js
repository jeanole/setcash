// ========== Utility Functions ==========

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount || 0);
}

// Parse number accepting both comma and dot as decimal separator
function parseNum(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  var s = String(val).trim();
  var lastDot = s.lastIndexOf('.');
  var lastComma = s.lastIndexOf(',');
  if (lastComma > lastDot) {
    s = s.replace(/\./g, '').replace(',', '.');
  }
  return parseFloat(s) || 0;
}

function showMessage(elementId, text, isError) {
  const el = document.getElementById(elementId);
  el.textContent = text;
  el.className = isError
    ? 'bg-rose-50 text-rose-700 border border-rose-200 rounded-lg px-4 py-3 text-sm mt-3'
    : 'bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg px-4 py-3 text-sm mt-3';
  setTimeout(() => { el.textContent = ''; el.className = ''; }, 3000);
}

// Netto calculation helper
function calcNetto(brutto, taxRate) {
  return (parseFloat(brutto) || 0) / (1 + taxRate);
}

// Aliases used by admin code
var esc = escapeHtml;
var fmt = formatCurrency;
var msg = showMessage;
