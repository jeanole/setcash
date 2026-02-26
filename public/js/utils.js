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

// ========== CSRF-aware fetch helper ==========

async function initCsrfToken() {
  if (csrfToken) return;
  try {
    const res = await fetch('/api/csrf-token', { credentials: 'same-origin' });
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.token) {
      csrfToken = data.token;
    }
  } catch (e) {
    console.error('Error loading CSRF token', e);
  }
}

function withCsrf(options) {
  const opts = options || {};
  const method = (opts.method || 'GET').toUpperCase();
  if (!csrfToken || method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return opts;
  }
  const headers = new Headers(opts.headers || {});
  headers.set('X-CSRF-Token', csrfToken);
  return Object.assign({}, opts, { headers });
}

async function apiFetch(input, options) {
  const opts = withCsrf(options);
  const res = await fetch(input, opts);
  if (res.status === 403) {
    // Generic handling for CSRF/authorization errors
    try {
      const cloned = res.clone();
      const data = await cloned.json().catch(() => null);
      const msgText =
        (data && (data.error || data.message)) ||
        'Your session or security token is invalid. Please reload the page and sign in again.';
      console.warn('Request rejected with 403:', msgText);
    } catch (e) {
      console.warn('Request rejected with 403 and non-JSON body');
    }
  }
  return res;
}

// Aliases used by admin code
var esc = escapeHtml;
var fmt = formatCurrency;
var msg = showMessage;
