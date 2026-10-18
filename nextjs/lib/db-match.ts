// ============================================================================
// Case-insensitive equality filters for Prisma string fields
// ============================================================================
// Prisma compiles `{ equals: x, mode: 'insensitive' }` to `ILIKE $1` on
// PostgreSQL WITHOUT escaping, so `_` and `%` in the value act as wildcards
// (`sup_r@x` would match `super@x`). Always build case-insensitive equality
// filters through this helper. No imports: safe for the server build.
// ============================================================================

/** Escape LIKE/ILIKE wildcards (`\`, `%`, `_`) using PostgreSQL's default escape character. */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

/** Case-insensitive exact match: `{ email: insensitiveEquals(address) }`. */
export function insensitiveEquals(value: string): { equals: string; mode: 'insensitive' } {
  return { equals: escapeLikePattern(value), mode: 'insensitive' };
}
