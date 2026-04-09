// ============================================================================
// Tour API Client
// ============================================================================

export async function completeTour(): Promise<{ success: boolean }> {
  const response = await fetch('/api/tour/complete', { method: 'POST' });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}
