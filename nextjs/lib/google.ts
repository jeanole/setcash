// ============================================================================
// Google API Utility
// ============================================================================
// Port of google.js — provides Sheets API client and credentials management
// ============================================================================

import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';

// Legacy location (cwd/../data) — read-only fallback for existing dev setups.
// In Docker this resolves to /data, which is neither writable nor persistent.
const LEGACY_DATA_DIR = path.join(process.cwd(), '..', 'data');

// Where service-account credentials are stored. Resolution order:
//   1. GOOGLE_CREDENTIALS_DIR (explicit; should point at a persistent volume)
//   2. <UPLOADS_DIR>/.google-credentials — UPLOADS_DIR is the persistent volume
//      in the Docker image, so credentials survive container restarts
//   3. the legacy cwd/../data directory
const DATA_DIR = process.env.GOOGLE_CREDENTIALS_DIR
  ? path.resolve(process.env.GOOGLE_CREDENTIALS_DIR)
  : process.env.UPLOADS_DIR
  ? path.join(path.resolve(process.env.UPLOADS_DIR), '.google-credentials')
  : LEGACY_DATA_DIR;

export function getCredentialsPath(projectId: string): string | null {
  const filename = path.basename(`google-credentials-${projectId}.json`);
  const dataPath = path.join(DATA_DIR, filename);
  if (fs.existsSync(dataPath)) return dataPath;
  const legacyPath = path.join(LEGACY_DATA_DIR, filename);
  if (fs.existsSync(legacyPath)) return legacyPath;
  return null;
}

// Default timeout for googleapis HTTP requests (30 s). Prevents stalled Google
// API calls from blocking request handlers indefinitely.
const GOOGLE_REQUEST_TIMEOUT_MS = 30_000;

export async function getSheets(projectId: string) {
  const credPath = getCredentialsPath(projectId);
  if (!credPath) return null;
  const auth = new google.auth.GoogleAuth({
    keyFile: credPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth, timeout: GOOGLE_REQUEST_TIMEOUT_MS });
}

export function saveCredentials(jsonContent: string, projectId: string): void {
  // Sanitize projectId so it cannot escape DATA_DIR via path traversal.
  // path.basename strips any directory components; we then verify the final
  // resolved path is still inside DATA_DIR before writing.
  const safeFilename = path.basename('google-credentials-' + projectId + '.json');
  const credPath = path.join(DATA_DIR, safeFilename);
  const resolvedCred = path.resolve(credPath);
  const resolvedData = path.resolve(DATA_DIR);
  if (resolvedCred !== resolvedData && !resolvedCred.startsWith(resolvedData + path.sep)) {
    throw new Error('Invalid projectId: path escapes DATA_DIR');
  }
  fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(credPath, jsonContent, { encoding: 'utf-8', mode: 0o600 });
}

export function validateCredentialsJson(jsonContent: string): { valid: boolean; error?: string } {
  try {
    const parsed = JSON.parse(jsonContent);
    const required = ['type', 'project_id', 'private_key', 'client_email'];
    for (const field of required) {
      if (!parsed[field]) {
        return { valid: false, error: `Missing required field: ${field}` };
      }
    }
    if (parsed.type !== 'service_account') {
      return { valid: false, error: 'Credentials must be a service account key' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid JSON' };
  }
}
