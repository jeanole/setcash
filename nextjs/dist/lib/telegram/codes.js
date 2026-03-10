"use strict";
// ============================================================================
// Telegram Link Codes
// ============================================================================
// Generates and validates one-time codes for linking Telegram accounts.
// Codes are 6 uppercase alphanumeric characters, valid for 10 minutes.
// ============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateLinkCode = generateLinkCode;
exports.validateAndConsumeLinkCode = validateAndConsumeLinkCode;
const crypto_1 = __importDefault(require("crypto"));
const db_1 = require("../db");
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CODE_LENGTH = 6;
const TTL_MS = 10 * 60 * 1000; // 10 minutes
/**
 * Generate a cryptographically secure 6-character uppercase alphanumeric code.
 */
function generateCode() {
    const bytes = crypto_1.default.randomBytes(CODE_LENGTH);
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
async function generateLinkCode(userEmail, projectId) {
    // Delete existing codes for this user+project
    await db_1.prisma.telegramLinkCode.deleteMany({
        where: { userEmail, projectId },
    });
    const code = generateCode();
    const expires = new Date(Date.now() + TTL_MS);
    await db_1.prisma.telegramLinkCode.create({
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
async function validateAndConsumeLinkCode(code, projectId) {
    const now = new Date();
    const linkCode = await db_1.prisma.telegramLinkCode.findFirst({
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
    await db_1.prisma.telegramLinkCode.delete({
        where: { code },
    });
    return { userEmail: linkCode.userEmail };
}
