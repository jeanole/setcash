import { PrismaClient } from '@prisma/client';
import { validateEnv } from './env';

// Validate required environment variables before Prisma attempts to connect
validateEnv();

// Prevent multiple instances of Prisma Client in development (hot-reload safe)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

// Export prisma as alias for db (for compatibility with existing code)
export const prisma = db;

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}

/**
 * Checks whether a database error is transient (e.g. the DB is still starting
 * up or in recovery) and therefore safe to retry.
 */
function isTransientDbError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('the database system is not yet accepting connections') ||
    msg.includes('connection refused') ||
    msg.includes('econnrefused') ||
    msg.includes('cannot connect now') ||
    msg.includes('connection reset') ||
    msg.includes('socket hang up')
  );
}

/**
 * Wraps a Prisma operation with retry logic for transient database errors.
 * Retries up to `maxRetries` times with exponential back-off starting at
 * `baseDelayMs` milliseconds.
 *
 * @example
 * const bill = await withDbRetry(() => prisma.bill.findFirst({ where: { id } }));
 */
export async function withDbRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 150
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isTransientDbError(err) || attempt === maxRetries) {
        throw err;
      }
      // Exponential back-off: 150 ms, 300 ms, 600 ms, …
      await new Promise((resolve) =>
        setTimeout(resolve, baseDelayMs * Math.pow(2, attempt))
      );
    }
  }
  // This line is unreachable, but satisfies TypeScript.
  throw lastError;
}
