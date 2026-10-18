// ============================================================================
// File Upload Utility
// ============================================================================
// Uses formidable for multipart/form-data parsing in Next.js App Router
// ============================================================================

import { IncomingForm, Fields, Files, File } from 'formidable';
import { IncomingMessage } from 'http';
import { Readable, Transform, pipeline } from 'stream';
import type { ReadableStream as NodeWebReadableStream } from 'stream/web';
import crypto from 'crypto';
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

// Default max files per request
const DEFAULT_MAX_FILES = 10;

// Allowance on top of the file payload for multipart boundaries and text fields
const FORM_OVERHEAD_BYTES = 1024 * 1024;

// Cap for the combined size of all non-file form fields
const MAX_FIELDS_SIZE = 512 * 1024;

// How long a failed parse waits for half-written files to close before it
// answers; files still open after that are removed as soon as they close
const FILE_CLOSE_WAIT_MS = 2000;

/**
 * Error raised by parseForm for malformed or oversized uploads. `status` is the
 * HTTP status the route should answer with; `message` is safe to show clients.
 */
export class UploadError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'UploadError';
    this.status = status;
  }
}

/**
 * Map an UploadError to a JSON response. Returns null for any other error so
 * callers can fall through to their generic 500 handling.
 */
export function uploadErrorResponse(error: unknown): Response | null {
  if (error instanceof UploadError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return null;
}

// Translate a formidable (or stream) failure into a client-safe UploadError
function toUploadError(err: unknown): UploadError {
  if (err instanceof UploadError) return err;
  const httpCode = (err as { httpCode?: number } | null)?.httpCode;
  console.error('Upload parse error:', err);
  if (httpCode === 413) return new UploadError('Upload too large', 413);
  if (httpCode === 415) return new UploadError('Unsupported upload type', 415);
  return new UploadError('Invalid upload', 400);
}

/**
 * Parse multipart form data from a Next.js request.
 *
 * The body is streamed straight into formidable (no in-memory buffering) and
 * is capped at `maxFiles * MAX_FILE_SIZE` plus a small overhead. Requests that
 * declare a larger Content-Length are rejected up front, and the byte cap is
 * enforced while reading for chunked bodies (no Content-Length, e.g. behind
 * some proxies) and in case the header lies.
 *
 * `options.fields` lists the file field names the caller expects. File parts
 * under any other name are never written to disk. A file part with a disallowed
 * extension fails the request with UploadError(415). Whenever the parse fails
 * (limits, malformed body, bad extension) every file written so far is removed,
 * including parts that were still in flight when the failure happened, so a
 * rejected upload leaves nothing behind.
 */
export async function parseForm(
  req: Request,
  options: { maxFiles?: number; fields?: string[] } = {}
): Promise<ParsedForm> {
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
  const maxBytes = maxFiles * MAX_FILE_SIZE + FORM_OVERHEAD_BYTES;

  const contentType = req.headers.get('content-type') || '';

  if (!contentType.includes('multipart/form-data')) {
    throw new UploadError('Content-Type must be multipart/form-data', 415);
  }

  const lengthHeader = req.headers.get('content-length');
  const contentLength = lengthHeader ? Number(lengthHeader) : null;
  if (contentLength !== null && (!Number.isFinite(contentLength) || contentLength < 0)) {
    throw new UploadError('Invalid Content-Length header', 400);
  }
  if (contentLength !== null && contentLength > maxBytes) {
    throw new UploadError('Upload too large', 413);
  }
  if (!req.body) {
    throw new UploadError('Empty request body', 400);
  }

  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  const expectedFields = options.fields;

  // Count bytes as they arrive and abort once the cap is exceeded
  let received = 0;
  // Remembered separately: formidable may report the aborted stream with its own
  // (400) error instead of the one the limiter raised
  let limitError: UploadError | null = null;
  const limiter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      received += chunk.length;
      if (received > maxBytes) {
        limitError = new UploadError('Upload too large', 413);
        callback(limitError);
        return;
      }
      callback(null, chunk);
    },
  }) as Transform & { headers?: Record<string, string> };
  limiter.headers = contentLength !== null
    ? { 'content-type': contentType, 'content-length': String(contentLength) }
    : { 'content-type': contentType, 'transfer-encoding': 'chunked' };

  const source = Readable.fromWeb(req.body as unknown as NodeWebReadableStream);
  // pipeline tears down both streams on failure and surfaces the error on `limiter`
  pipeline(source, limiter, () => { /* errors are handled via the form callback */ });

  return new Promise((resolve, reject) => {
    // Every file formidable starts writing is tracked so it can be removed again
    // on any failure path, whatever state formidable itself is in. `closed`
    // resolves once the file's write stream has closed (nothing writes to it any
    // more, so it can be unlinked for good).
    const tracked: { filepath: string; closed: Promise<void> }[] = [];
    const unlinkTracked = (filepath: string) => {
      try { fs.unlinkSync(filepath); } catch { /* already gone */ }
    };
    // Set by the filter when a file part must fail the whole request
    let rejection: UploadError | null = null;

    const form = new IncomingForm({
      uploadDir: UPLOADS_DIR,
      keepExtensions: true,
      maxFileSize: MAX_FILE_SIZE,
      maxTotalFileSize: maxFiles * MAX_FILE_SIZE,
      maxFiles,
      maxFieldsSize: MAX_FIELDS_SIZE,
      // Only called for file parts. Returning false means "never write this part".
      filter: (part) => {
        // Parts under a field name the caller does not expect are never persisted
        if (expectedFields && !(part.name && expectedFields.includes(part.name))) return false;
        // An empty file input (no filename) carries no upload
        if (!part.originalFilename) return false;
        const ext = path.extname(part.originalFilename).toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
          rejection ??= new UploadError(
            `File type not allowed: ${ext || part.originalFilename}`,
            415
          );
          return false;
        }
        return true;
      },
    });

    // Emitted right before formidable opens the file for writing. Formidable's
    // part handling is asynchronous, so parts that were already in flight when it
    // failed (e.g. files past `maxFiles`) still reach this point after the error.
    form.on('fileBegin', (_name, file) => {
      const handle = file as unknown as {
        _writeStream?: fs.WriteStream | null;
        open: () => void;
        write: (buffer: Buffer, cb?: () => void) => void;
        end: (cb?: () => void) => void;
        destroy: () => void;
      };
      if ((form as unknown as { error?: unknown }).error) {
        // The request has already failed: never create this file
        handle.open = () => { /* skipped */ };
        handle.write = (_buffer, cb) => { cb?.(); };
        handle.end = (cb) => { cb?.(); };
        handle.destroy = () => { /* nothing was opened */ };
        return;
      }
      let markClosed: () => void = () => { /* replaced below */ };
      const closed = new Promise<void>((res) => { markClosed = res; });
      tracked.push({ filepath: file.filepath, closed });
      // formidable calls file.open() synchronously after this event, so the
      // write stream exists by the next microtask
      queueMicrotask(() => {
        const stream = handle._writeStream;
        if (!stream || stream.closed) markClosed();
        else stream.once('close', markClosed);
      });
    });

    // Stop reading the body, wait (bounded) for the open write streams to close,
    // then remove every file written so far. A file that is still open after the
    // wait is removed as soon as it closes.
    const fail = (err: UploadError) => {
      limiter.destroy();
      for (const t of tracked) {
        void t.closed.then(() => unlinkTracked(t.filepath));
      }
      let timer: NodeJS.Timeout | undefined;
      const timeout = new Promise<void>((res) => {
        timer = setTimeout(res, FILE_CLOSE_WAIT_MS);
      });
      void Promise.race([Promise.all(tracked.map((t) => t.closed)), timeout]).then(() => {
        clearTimeout(timer);
        for (const t of tracked) unlinkTracked(t.filepath);
        reject(err);
      });
    };

    form.parse(limiter as unknown as IncomingMessage, (err, fields, files) => {
      if (err) {
        // The limiter's own 413 beats whatever formidable reports for the aborted stream
        fail(limitError ?? toUploadError(err));
        return;
      }
      if (rejection) {
        fail(rejection);
        return;
      }
      if (expectedFields) {
        // Defence in depth: nothing outside the expected fields survives
        for (const [name, entry] of Object.entries(files)) {
          if (expectedFields.includes(name)) continue;
          for (const f of Array.isArray(entry) ? entry : entry ? [entry] : []) {
            unlinkTracked(f.filepath);
          }
          delete (files as Record<string, unknown>)[name];
        }
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
    const buf = Buffer.alloc(12);
    const fd = fs.openSync(filepath, 'r');
    try {
      fs.readSync(fd, buf, 0, 12, 0);
    } finally {
      fs.closeSync(fd);
    }
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
 * alphanumeric, '.', '_', or '-' with an underscore. Leading dots are replaced
 * too so the segment can never be '.' or '..'.
 */
function sanitizeEmailLocalPart(email: string): string {
  return email
    .split('@')[0]
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .replace(/^\./, '_')
    .slice(0, 64) || '_';
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
 * Generate a unique filename for a bill image.
 *
 * The human-readable prefix (user folder, label, date, index) is followed by a
 * random component so two uploads can never resolve to the same storage path
 * (renameSync would silently overwrite). The extension comes from the upload's
 * original name but is restricted to the allowed list.
 */
export function generateFilename(
  userFolder: string,
  billNumber: string,
  dateStr: string,
  suffix: string = '',
  originalFilename: string = ''
): string {
  const rawExt = path.extname(originalFilename).toLowerCase();
  const ext = ALLOWED_EXTENSIONS.includes(rawExt) ? rawExt : '.jpg';
  const safeLabel = billNumber.replace(/[^A-Za-z0-9._-]/g, '_');
  const unique = crypto.randomBytes(8).toString('hex');
  return `${userFolder}_${safeLabel}_${dateStr}${suffix}_${unique}${ext}`;
}

/**
 * Resolve a stored relative path inside UPLOADS_DIR, or null if it would
 * escape the uploads root.
 */
function resolveUploadPath(filePath: string): string | null {
  const root = path.resolve(UPLOADS_DIR);
  const resolved = path.resolve(root, filePath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null;
  return resolved;
}

/**
 * Delete a file from the uploads directory
 */
export function deleteFile(filePath: string): void {
  if (!filePath) return;
  
  const fullPath = resolveUploadPath(filePath);
  if (!fullPath) return;
  
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
  
  const fullPath = resolveUploadPath(filePath);
  if (!fullPath) return null;
  
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  
  return fs.readFileSync(fullPath);
}
