#!/usr/bin/env tsx
/**
 * Migrate local bill images to S3-compatible object storage.
 *
 * Reads every BillImage.filePath from the database, checks whether the object
 * already exists in S3 (skips if so), then uploads the local file.
 *
 * Prerequisites:
 *   - STORAGE_ENDPOINT, STORAGE_BUCKET, STORAGE_ACCESS_KEY, STORAGE_SECRET_KEY
 *     must be set in the environment (or .env.local).
 *   - UPLOADS_DIR must point to the directory containing the local files
 *     (default: <repo>/data/uploads).
 *
 * Usage:
 *   cd nextjs
 *   npx tsx scripts/migrate-uploads-to-s3.ts
 */

import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  HeadObjectCommandOutput,
} from '@aws-sdk/client-s3';

// ── Load .env.local if present ────────────────────────────────────────────────
const envLocalPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envLocalPath)) {
  const lines = fs.readFileSync(envLocalPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

// ── Validate required env vars ────────────────────────────────────────────────
const STORAGE_ENDPOINT = process.env.STORAGE_ENDPOINT || '';
const STORAGE_BUCKET   = process.env.STORAGE_BUCKET   || '';
const STORAGE_REGION   = process.env.STORAGE_REGION   || 'auto';
const STORAGE_ACCESS_KEY = process.env.STORAGE_ACCESS_KEY || '';
const STORAGE_SECRET_KEY = process.env.STORAGE_SECRET_KEY || '';
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', 'data', 'uploads');

if (!STORAGE_ENDPOINT || !STORAGE_BUCKET) {
  console.error('ERROR: STORAGE_ENDPOINT and STORAGE_BUCKET must be set.');
  process.exit(1);
}

if (!STORAGE_ACCESS_KEY || !STORAGE_SECRET_KEY) {
  console.error('ERROR: STORAGE_ACCESS_KEY and STORAGE_SECRET_KEY must be set.');
  process.exit(1);
}

// ── S3 client ─────────────────────────────────────────────────────────────────
const s3 = new S3Client({
  endpoint: STORAGE_ENDPOINT,
  region: STORAGE_REGION,
  credentials: {
    accessKeyId: STORAGE_ACCESS_KEY,
    secretAccessKey: STORAGE_SECRET_KEY,
  },
  forcePathStyle: true,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

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

async function existsInS3(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: STORAGE_BUCKET, Key: key }));
    return true;
  } catch (e: unknown) {
    const name = (e as { name?: string })?.name;
    if (name === 'NotFound' || name === 'NoSuchKey') return false;
    throw e;
  }
}

async function uploadToS3(key: string, buffer: Buffer): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: STORAGE_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeFromKey(key),
    })
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const prisma = new PrismaClient();

  console.log(`\nMigrating local bill images to S3`);
  console.log(`  Endpoint : ${STORAGE_ENDPOINT}`);
  console.log(`  Bucket   : ${STORAGE_BUCKET}`);
  console.log(`  Local dir: ${UPLOADS_DIR}\n`);

  const images = await prisma.billImage.findMany({
    select: { id: true, filePath: true },
    orderBy: { id: 'asc' },
  });

  console.log(`Found ${images.length} image record(s) in the database.\n`);

  let uploaded = 0;
  let skippedAlreadyInS3 = 0;
  let skippedMissingLocal = 0;
  let failed = 0;

  for (let i = 0; i < images.length; i++) {
    const { id, filePath } = images[i];
    if (!filePath) {
      console.log(`[${i + 1}/${images.length}] SKIP  — no filePath on image ${id}`);
      skippedMissingLocal++;
      continue;
    }

    const localPath = path.join(UPLOADS_DIR, filePath);
    const progress = `[${i + 1}/${images.length}]`;

    // Check if already uploaded
    try {
      if (await existsInS3(filePath)) {
        console.log(`${progress} SKIP  — already in S3: ${filePath}`);
        skippedAlreadyInS3++;
        continue;
      }
    } catch (e) {
      console.error(`${progress} ERROR — S3 head-check failed for ${filePath}:`, (e as Error).message);
      failed++;
      continue;
    }

    // Check local file exists
    if (!fs.existsSync(localPath)) {
      console.log(`${progress} SKIP  — not found locally: ${filePath}`);
      skippedMissingLocal++;
      continue;
    }

    // Upload
    try {
      const buffer = fs.readFileSync(localPath);
      await uploadToS3(filePath, buffer);
      console.log(`${progress} OK    — uploaded ${filePath} (${buffer.length} bytes)`);
      uploaded++;
    } catch (e) {
      console.error(`${progress} ERROR — upload failed for ${filePath}:`, (e as Error).message);
      failed++;
    }
  }

  await prisma.$disconnect();

  console.log('\n── Summary ─────────────────────────────────────────────');
  console.log(`  Total records   : ${images.length}`);
  console.log(`  Uploaded        : ${uploaded}`);
  console.log(`  Already in S3   : ${skippedAlreadyInS3}`);
  console.log(`  Missing locally : ${skippedMissingLocal}`);
  console.log(`  Failed          : ${failed}`);
  console.log('────────────────────────────────────────────────────────\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Unhandled error:', e);
  process.exit(1);
});
