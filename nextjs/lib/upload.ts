// ============================================================================
// File Upload Utility
// ============================================================================
// Uses formidable for multipart/form-data parsing in Next.js App Router
// ============================================================================

import { IncomingForm, Fields, Files, File } from 'formidable';
import { IncomingMessage } from 'http';
import fs from 'fs';
import path from 'path';

export const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), '..', 'data', 'uploads');

export interface ParsedForm {
  fields: Fields;
  files: Files;
}

// Allowed file types
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Parse multipart form data from a Next.js request
 */
export async function parseForm(req: Request): Promise<ParsedForm> {
  // Convert Web Request to Node IncomingMessage-like object
  const contentType = req.headers.get('content-type') || '';
  
  if (!contentType.includes('multipart/form-data')) {
    throw new Error('Content-Type must be multipart/form-data');
  }

  // Create a temporary buffer to hold the request body
  const arrayBuffer = await req.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Create a mock IncomingMessage
  const mockReq = new (require('stream').Readable)();
  mockReq.push(buffer);
  mockReq.push(null);
  mockReq.headers = {
    'content-type': contentType,
    'content-length': buffer.length.toString(),
  };

  return new Promise((resolve, reject) => {
    const form = new IncomingForm({
      uploadDir: UPLOADS_DIR,
      keepExtensions: true,
      maxFileSize: MAX_FILE_SIZE,
      maxFiles: 10,
      filter: (part) => {
        const ext = path.extname(part.originalFilename || '').toLowerCase();
        return ALLOWED_EXTENSIONS.includes(ext);
      },
    });

    form.parse(mockReq as unknown as IncomingMessage, (err, fields, files) => {
      if (err) {
        reject(err);
        return;
      }
      resolve({ fields, files });
    });
  });
}

/**
 * Get array of uploaded files from form result
 */
export function getUploadedFiles(files: Files, fieldName: string): File[] {
  const fileOrFiles = files[fieldName];
  if (!fileOrFiles) return [];
  if (Array.isArray(fileOrFiles)) return fileOrFiles;
  return [fileOrFiles];
}

/**
 * Get single uploaded file from form result
 */
export function getUploadedFile(files: Files, fieldName: string): File | null {
  const fileOrFiles = files[fieldName];
  if (!fileOrFiles) return null;
  if (Array.isArray(fileOrFiles)) return fileOrFiles[0] || null;
  return fileOrFiles;
}

/**
 * Detect file type from magic bytes (first 12 bytes of the file).
 * Returns a normalized type string or null if unrecognised.
 */
function detectMagicType(filepath: string): string | null {
  try {
    const buf = fs.readFileSync(filepath).slice(0, 12);
    // JPEG: FF D8 FF
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
    // WebP: RIFF????WEBP — bytes 0-3 = RIFF, bytes 8-11 = WEBP
    if (
      buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
    ) return 'webp';
    // PDF: %PDF
    if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return 'pdf';
    return null;
  } catch {
    return null;
  }
}

/** Extension → allowed magic types */
const EXT_TO_MAGIC: Record<string, string[]> = {
  '.jpg':  ['jpeg'],
  '.jpeg': ['jpeg'],
  '.png':  ['png'],
  '.webp': ['webp'],
  '.pdf':  ['pdf'],
};

/**
 * Validate file type and size
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  const ext = path.extname(file.originalFilename || '').toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { valid: false, error: `File type not allowed: ${ext}` };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File too large. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB` };
  }

  // Magic byte check — verify actual content matches the declared extension
  if (file.filepath) {
    const detectedType = detectMagicType(file.filepath);
    const allowedTypes = EXT_TO_MAGIC[ext] ?? [];
    if (!detectedType || !allowedTypes.includes(detectedType)) {
      // Remove the temp file so it is not left on disk
      try { fs.unlinkSync(file.filepath); } catch { /* ignore */ }
      return { valid: false, error: `File content does not match declared type: ${ext}` };
    }
  }

  return { valid: true };
}

/**
 * Sanitize the local-part of an email address for use as a filesystem path
 * segment. Takes everything before '@' and replaces any character that is not
 * alphanumeric, '.', '_', or '-' with an underscore.
 */
function sanitizeEmailLocalPart(email: string): string {
  return email.split('@')[0].replace(/[^A-Za-z0-9._-]/g, '_');
}

/**
 * Ensure upload directory exists for a user
 */
export function ensureUploadDir(userEmail: string): string {
  const userFolder = sanitizeEmailLocalPart(userEmail);
  const userDir = path.join(UPLOADS_DIR, userFolder);
  
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }
  
  return userFolder;
}

/**
 * Generate unique filename for bill image
 */
export function generateFilename(
  userFolder: string,
  billNumber: string,
  dateStr: string,
  suffix: string = '',
  originalFilename: string = ''
): string {
  const ext = path.extname(originalFilename) || '.jpg';
  return `${userFolder}_${billNumber}_${dateStr}${suffix}${ext}`;
}

/**
 * Delete a file from the uploads directory
 */
export function deleteFile(filePath: string): void {
  if (!filePath) return;
  
  const fullPath = path.join(UPLOADS_DIR, filePath);
  
  if (fs.existsSync(fullPath)) {
    try {
      fs.unlinkSync(fullPath);
    } catch (e) {
      console.error('Failed to delete file:', e);
    }
  }
}

/**
 * Read file for OCR processing
 */
export function readFileForOCR(filePath: string): Buffer | null {
  if (!filePath) return null;
  
  const fullPath = path.join(UPLOADS_DIR, filePath);
  
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  
  return fs.readFileSync(fullPath);
}
