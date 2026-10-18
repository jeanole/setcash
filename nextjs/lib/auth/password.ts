// ============================================================================
// Shared password policy — used by signup, reset, change and invite acceptance
// ============================================================================

import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  // bcrypt only uses the first 72 bytes; cap length to bound hashing cost
  .max(128, 'Password must be at most 128 characters.')
  .regex(/[a-z]/, 'Password must contain a lowercase letter.')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter.')
  .regex(/[0-9]/, 'Password must contain a digit.');
