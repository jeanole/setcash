// ============================================================================
// Google API Utility
// ============================================================================
// Port of google.js — provides Sheets API client and credentials management
// ============================================================================

import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';

const DATA_DIR = path.join(process.cwd(), '..', 'data');

export function getCredentialsPath(projectId: string): string | null {
  const dataPath = path.join(DATA_DIR, `google-credentials-${projectId}.json`);
  if (fs.existsSync(dataPath)) return dataPath;
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
  fs.writeFileSync(credPath, jsonContent, 'utf-8');
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
