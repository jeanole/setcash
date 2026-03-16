// ============================================================================
// Storage Adapter
// ============================================================================
// Unified storage interface for bill images.
// When STORAGE_ENDPOINT + STORAGE_BUCKET env vars are set, files are stored
// in an S3-compatible object store (MinIO, Hetzner Object Storage, AWS S3, …).
// Otherwise, falls back to the local filesystem under UPLOADS_DIR.
// ============================================================================

import fs from 'fs';
import path from 'path';
import { UPLOADS_DIR } from './upload';

// ── S3 config ────────────────────────────────────────────────────────────────

const STORAGE_ENDPOINT = process.env.STORAGE_ENDPOINT || '';
const STORAGE_BUCKET   = process.env.STORAGE_BUCKET   || '';
const STORAGE_REGION   = process.env.STORAGE_REGION   || 'auto';
const STORAGE_ACCESS_KEY = process.env.STORAGE_ACCESS_KEY || '';
const STORAGE_SECRET_KEY = process.env.STORAGE_SECRET_KEY || '';

// ── Feature flag ─────────────────────────────────────────────────────────────

/**
 * Returns true when S3-compatible storage is configured via environment vars.
 */
export function isS3Enabled(): boolean {
  return Boolean(STORAGE_ENDPOINT && STORAGE_BUCKET);
}

// ── Lazy singleton S3Client ───────────────────────────────────────────────────

let _s3Client: import('@aws-sdk/client-s3').S3Client | null = null;

async function getS3Client(): Promise<import('@aws-sdk/client-s3').S3Client> {
  if (_s3Client) return _s3Client;
  const { S3Client } = await import('@aws-sdk/client-s3');
  _s3Client = new S3Client({
    endpoint: STORAGE_ENDPOINT,
    region: STORAGE_REGION,
    credentials: {
      accessKeyId: STORAGE_ACCESS_KEY,
      secretAccessKey: STORAGE_SECRET_KEY,
    },
    forcePathStyle: true, // required for MinIO / Hetzner compatibility
  });
  return _s3Client;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Upload a file to S3 or local disk.
 *
 * @param key         Relative path / object key (e.g. "jens/jens_1.01_2026-03-16.jpg")
 * @param buffer      File content as Buffer
 * @param contentType MIME type (optional; auto-detected from extension when omitted)
 */
export async function uploadFile(
  key: string,
  buffer: Buffer,
  contentType?: string
): Promise<void> {
  const mimeType = contentType ?? mimeFromKey(key);

  if (isS3Enabled()) {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await getS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: STORAGE_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      })
    );
    return;
  }

  // Local fallback
  const fullPath = path.join(UPLOADS_DIR, key);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, buffer);
}

/**
 * Delete a file from S3 or local disk.
 * Errors are logged but not re-thrown (non-fatal for bill deletion flows).
 *
 * @param key Relative path / object key
 */
export async function deleteFile(key: string): Promise<void> {
  if (!key) return;

  if (isS3Enabled()) {
    try {
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
      const client = await getS3Client();
      await client.send(
        new DeleteObjectCommand({
          Bucket: STORAGE_BUCKET,
          Key: key,
        })
      );
    } catch (e) {
      console.error('[storage] Failed to delete S3 object:', key, e);
    }
    return;
  }

  // Local fallback
  const fullPath = path.join(UPLOADS_DIR, key);
  if (fs.existsSync(fullPath)) {
    try {
      fs.unlinkSync(fullPath);
    } catch (e) {
      console.error('[storage] Failed to delete local file:', fullPath, e);
    }
  }
}

/**
 * Get a URL to access the file.
 * - S3 mode: returns a presigned GET URL valid for 1 hour.
 * - Local mode: returns `/api/uploads/<key>`.
 *
 * @param key Relative path / object key
 */
export async function getFileUrl(key: string): Promise<string> {
  if (!key) return '';

  if (isS3Enabled()) {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const client = await getS3Client();
    const command = new GetObjectCommand({
      Bucket: STORAGE_BUCKET,
      Key: key,
    });
    return getSignedUrl(client, command, { expiresIn: 3600 });
  }

  // Local fallback — served by /api/uploads/[[...path]]
  return `/api/uploads/${key}`;
}

/**
 * Read raw bytes for a file (used by OCR, PDF export, image export).
 * Returns null when the file does not exist.
 *
 * @param key Relative path / object key
 */
export async function getFileBuffer(key: string): Promise<Buffer | null> {
  if (!key) return null;

  if (isS3Enabled()) {
    try {
      const { GetObjectCommand } = await import('@aws-sdk/client-s3');
      const client = await getS3Client();
      const response = await client.send(
        new GetObjectCommand({
          Bucket: STORAGE_BUCKET,
          Key: key,
        })
      );
      const stream = response.Body as import('stream').Readable;
      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
      });
    } catch (e: unknown) {
      // NoSuchKey or similar — file not found
      const code = (e as { name?: string })?.name;
      if (code === 'NoSuchKey' || code === 'NotFound') return null;
      console.error('[storage] Failed to read S3 object:', key, e);
      return null;
    }
  }

  // Local fallback
  const fullPath = path.join(UPLOADS_DIR, key);
  if (!fs.existsSync(fullPath)) return null;
  try {
    return fs.readFileSync(fullPath);
  } catch (e) {
    console.error('[storage] Failed to read local file:', fullPath, e);
    return null;
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function mimeFromKey(key: string): string {
  const ext = path.extname(key).toLowerCase();
  switch (ext) {
    case '.png':  return 'image/png';
    case '.webp': return 'image/webp';
    case '.gif':  return 'image/gif';
    case '.pdf':  return 'application/pdf';
    default:      return 'image/jpeg';
  }
}

