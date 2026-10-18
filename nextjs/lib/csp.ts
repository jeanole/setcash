// ============================================================================
// Content-Security-Policy (nonce-based) — built per request in middleware.ts
// ============================================================================
// Scripts must carry the per-request nonce; 'strict-dynamic' lets those
// trusted scripts load others (Next.js chunks, the Turnstile loader). Next.js
// reads the nonce from the request's CSP header and applies it to its own
// scripts, which is why every page is rendered dynamically (app/layout.tsx).
// Edge-runtime safe: no Node APIs.
// ============================================================================

export const NONCE_HEADER = 'x-nonce';

const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';

export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function buildCsp(nonce: string, isDev: boolean): string {
  const directives: string[] = [
    "default-src 'self'",
    // 'unsafe-eval' only in development (React Refresh / dev overlay)
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    // Inline style attributes (React style props, cropper) need 'unsafe-inline'
    "style-src 'self' 'unsafe-inline'",
    // blob:/data: for local image previews and cropping
    "img-src 'self' blob: data:",
    "font-src 'self' data:",
    `connect-src 'self' ${TURNSTILE_ORIGIN}${isDev ? ' ws: wss:' : ''}`,
    `frame-src ${TURNSTILE_ORIGIN}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  // No upgrade-insecure-requests: it would break plain-HTTP (e.g. LAN)
  // deployments; HTTPS deployments are covered by HSTS.
  return directives.join('; ');
}
