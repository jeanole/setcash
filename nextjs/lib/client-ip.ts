// ============================================================================
// Client IP resolution for rate limiting
// ============================================================================
// Client-supplied headers such as X-Forwarded-For can be set to any value by
// the caller, so keying a rate limiter on them lets an attacker get a fresh
// bucket per request. We only trust:
//   1. The header named in TRUSTED_IP_HEADER (set by your reverse proxy), or
//      `cf-connecting-ip` by default (set by Cloudflare). Set
//      TRUSTED_IP_HEADER=none when the app is NOT behind a proxy.
//   2. The TCP peer address, stamped by server.ts into PEER_IP_HEADER (it
//      overwrites any client-sent value, so it cannot be spoofed).
// ============================================================================

export const PEER_IP_HEADER = 'x-setcash-peer-ip';

interface HeaderSource {
  headers: { get(name: string): string | null };
}

export function getClientIp(req: HeaderSource): string {
  const trustedHeader = (process.env.TRUSTED_IP_HEADER ?? 'cf-connecting-ip').trim().toLowerCase();

  if (trustedHeader && trustedHeader !== 'none') {
    const value = req.headers.get(trustedHeader)?.split(',')[0]?.trim();
    if (value) return value;
  }

  return req.headers.get(PEER_IP_HEADER)?.trim() || 'unknown';
}
