// ============================================================================
// Telegram Link Codes
// ============================================================================
// Generates and validates one-time codes for linking Telegram accounts.
// Codes are 6 uppercase alphanumeric characters, valid for 10 minutes.
// ============================================================================

import crypto from 'crypto';
import { prisma } from '../db';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CODE_LENGTH = 6;
const TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Generate a cryptographically secure 6-character uppercase alphanumeric code.
 */
function generateCode(): string {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

/**
 * Generate a link code for the given user+project.
 * Deletes any existing codes for this user+project first.
 * Returns the code and its expiry time.
 */
export async function generateLinkCode(
  userEmail: string,
  projectId: string
): Promise<{ code: string; expires: Date }> {
  // Delete existing codes for this user+project
  await prisma.telegramLinkCode.deleteMany({
    where: { userEmail, projectId },
  });

  const code = generateCode();
  const expires = new Date(Date.now() + TTL_MS);

  await prisma.telegramLinkCode.create({
    data: {
      code,
      userEmail,
      projectId,
      expiresAt: expires,
    },
  });

  return { code, expires };
}

/**
 * Validate and consume a link code.
 * Returns the associated userEmail on success, or null if invalid/expired.
 */
export async function validateAndConsumeLinkCode(
  code: string,
  projectId: string
): Promise<{ userEmail: string } | null> {
  const now = new Date();

  const linkCode = await prisma.telegramLinkCode.findFirst({
    where: {
      code,
      projectId,
      expiresAt: { gt: now },
    },
  });

  if (!linkCode) {
    return null;
  }

  // Delete code (single-use)
  await prisma.telegramLinkCode.delete({
    where: { code },
  });

  return { userEmail: linkCode.userEmail };
}
