import { handlers } from '../../../../auth';

// ---------------------------------------------------------------------------
// NextAuth v5 — HTTP route handlers
// Mounts GET and POST handlers from auth.ts
// Force Node.js runtime so Prisma can run in JWT/session callbacks
// ---------------------------------------------------------------------------

export const runtime = 'nodejs';

export const { GET, POST } = handlers;
