import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const gitCommit = (() => {
  if (process.env.NEXT_PUBLIC_GIT_COMMIT) {
    return process.env.NEXT_PUBLIC_GIT_COMMIT.slice(0, 7);
  }
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD']).toString().trim();
  } catch {
    return 'dev';
  }
})();

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_GIT_COMMIT: gitCommit,
  },
  output: 'standalone',
  // Pin the tracing root to this app so a stray lockfile in a parent folder
  // cannot change the standalone output layout the Dockerfile copies.
  outputFileTracingRoot: path.dirname(fileURLToPath(import.meta.url)),
  // The app never uses next/image. Disabling the optimizer makes /_next/image
  // return 404, removing the attack surface of the Image Optimization API
  // (several Next.js 14 advisories, incl. RCE/DoS, have no 14.x fix).
  images: { unoptimized: true },
  serverExternalPackages: ['pdfkit', 'fontkit'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      const existing = Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean);
      config.externals = [...existing, 'pdfkit', 'fontkit'];
    }
    return config;
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          // Directives that cannot break inline scripts/styles or third-party
          // widgets (Turnstile, Google OAuth); a full script-src policy would
          // need nonces wired through the App Router.
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
          },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
