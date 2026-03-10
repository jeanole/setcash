"use strict";
// ============================================================================
// Telegram Bot Token Encryption
// ============================================================================
// AES-256-GCM encryption for storing Telegram bot tokens at rest.
// Uses TELEGRAM_ENCRYPTION_KEY env var (64 hex chars = 32 bytes).
// ============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encrypt = encrypt;
exports.decrypt = decrypt;
const crypto_1 = __importDefault(require("crypto"));
const ENCRYPTION_KEY_HEX = process.env.TELEGRAM_ENCRYPTION_KEY;
function getKey() {
    if (!ENCRYPTION_KEY_HEX) {
        return null;
    }
    if (ENCRYPTION_KEY_HEX.length !== 64) {
        console.warn('[Telegram] TELEGRAM_ENCRYPTION_KEY must be 64 hex characters (32 bytes). Falling back to plaintext storage.');
        return null;
    }
    return Buffer.from(ENCRYPTION_KEY_HEX, 'hex');
}
/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns `iv:authTag:ciphertext` (all hex).
 * Falls back to returning plaintext if TELEGRAM_ENCRYPTION_KEY is not set (dev only).
 */
function encrypt(plaintext) {
    const key = getKey();
    if (!key) {
        if (process.env.NODE_ENV === 'production') {
            console.error('[Telegram] TELEGRAM_ENCRYPTION_KEY is not set in production. Bot tokens will not be encrypted!');
        }
        else {
            console.warn('[Telegram] TELEGRAM_ENCRYPTION_KEY not set — storing bot token as plaintext (dev only).');
        }
        return plaintext;
    }
    const iv = crypto_1.default.randomBytes(12);
    const cipher = crypto_1.default.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}
/**
 * Decrypt a string encrypted by `encrypt()`.
 * Returns the original plaintext, or null on failure.
 * If no TELEGRAM_ENCRYPTION_KEY is set, treats the input as plaintext (dev fallback).
 */
function decrypt(stored) {
    const key = getKey();
    if (!key) {
        // Dev fallback: stored value was never encrypted
        return stored;
    }
    // If stored value doesn't look encrypted, return as-is (migration fallback)
    if (!stored || !stored.includes(':')) {
        return stored;
    }
    try {
        const parts = stored.split(':');
        if (parts.length !== 3) {
            return stored;
        }
        const [ivHex, authTagHex, ciphertextHex] = parts;
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const ciphertext = Buffer.from(ciphertextHex, 'hex');
        const decipher = crypto_1.default.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);
        return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8');
    }
    catch (e) {
        console.error('[Telegram] Failed to decrypt bot token:', e.message);
        return null;
    }
}
