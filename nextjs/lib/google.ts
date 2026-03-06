// ============================================================================
// Google API Utility
// ============================================================================
// Port of google.js — provides Sheets API client and credentials management
// ============================================================================

import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';

const DATA_DIR = path.join(process.cwd(), '..', 'data');

export function getCredentialsPath(): string | null {
  const dataPath = path.join(DATA_DIR, 'google-credentials.json');
  if (fs.existsSync(dataPath)) return dataPath;
  return null;
}

export async function getSheets() {
  const credPath = getCredentialsPath();
  if (!credPath) return null;
  const auth = new google.auth.GoogleAuth({
    keyFile: credPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

export function saveCredentials(jsonContent: string): void {
  const credPath = path.join(DATA_DIR, 'google-credentials.json');
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
