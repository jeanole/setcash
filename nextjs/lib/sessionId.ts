/**
 * Get or create a per-tab session ID using sessionStorage.
 * Each browser tab gets its own session ID; closing the tab discards it.
 */
const SESSION_KEY = 'vb_sid';

export function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}
