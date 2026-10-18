// ============================================================================
// Bill Images API - POST
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';
import path from 'path';
import fs from 'fs';
import type { File } from 'formidable';
import {
  parseForm,
  getUploadedFiles,
  ensureUploadDir,
  generateFilename,
  validateFile,
  uploadErrorResponse,
  UPLOADS_DIR,
} from '@/lib/upload';
import { verifyAdminRole } from '@/lib/auth-guard';
import { billImageUploadLimiter } from '@/lib/ratelimit';
import {
  MAX_IMAGES_PER_BILL,
  imageEditLockResponse,
  runSerializable,
  syncLegacyImageColumns,
} from '@/app/api/bills/_lib/shared';

// Thrown inside the transaction when the per-bill image cap would be exceeded
class TooManyImagesError extends Error {
  constructor() {
    super(`Maximum ${MAX_IMAGES_PER_BILL} images per bill`);
    this.name = 'TooManyImagesError';
  }
}

// POST /api/bills/[id]/images - Add images to existing bill
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  // Temp files written by parseForm and files moved to their final location are
  // tracked so every early return / throw can clean them up.
  let uploadedFiles: File[] = [];
  const movedFilePaths: string[] = [];

  const cleanupFiles = () => {
    for (const f of uploadedFiles) {
      if (f.filepath && fs.existsSync(f.filepath)) {
        try { fs.unlinkSync(f.filepath); } catch { /* best-effort cleanup */ }
      }
    }
    for (const filePath of movedFilePaths) {
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (unlinkError) {
        console.error('File cleanup failed:', filePath, unlinkError);
      }
    }
  };

  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { success } = await billImageUploadLimiter.limit(session.user.id || session.user.email);
    if (!success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const projectId = session.user.currentProjectId;
    if (!projectId) {
      return NextResponse.json({ error: 'No project selected' }, { status: 400 });
    }

    const { id } = params;

    // Get bill
    const bill = await prisma.bill.findFirst({
      where: { id, projectId },
    });

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    // Check permissions - only submitter, project admin/owner, or superadmin can add images
    const isOwner = bill.submittedByEmail.toLowerCase() === session.user.email.toLowerCase();
    const sessionClaimsAdmin =
      session.user.role === 'admin' ||
      session.user.role === 'owner' ||
      session.user.role === 'superadmin';

    if (!isOwner && !sessionClaimsAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // SEC-02: non-owners are relying on admin authority — re-verify against
    // the DB rather than trusting the (possibly stale) JWT claim.
    if (!isOwner) {
      const guard = await verifyAdminRole(session.user.email, projectId);
      if (!guard.authorized) {
        return guard.response!;
      }
    }

    // Approved/paid bills: images are frozen unless the caller is a DB-verified admin
    const lockResponse = await imageEditLockResponse(bill.status, session.user.email, projectId);
    if (lockResponse) return lockResponse;

    // Parse multipart form (size-capped; throws UploadError for bad/oversized bodies)
    const { files } = await parseForm(req);

    // Get uploaded files
    uploadedFiles = getUploadedFiles(files, 'photos');

    if (uploadedFiles.length === 0) {
      return NextResponse.json({ error: 'No files' }, { status: 400 });
    }

    // Validate file content (magic bytes) before proceeding
    for (const f of uploadedFiles) {
      const result = validateFile(f);
      if (!result.valid) {
        cleanupFiles();
        return NextResponse.json({ error: result.error || 'Invalid file' }, { status: 400 });
      }
    }

    if (uploadedFiles.length > MAX_IMAGES_PER_BILL) {
      cleanupFiles();
      return NextResponse.json(
        { error: `Maximum ${MAX_IMAGES_PER_BILL} images per bill` },
        { status: 400 }
      );
    }

    // Move uploads to their final, collision-free location (random name
    // component) before the DB write; cleaned up again if the write fails.
    const userFolder = ensureUploadDir(bill.submittedByEmail);
    const dateStr = new Date().toISOString().split('T')[0];
    const stored: { id: string; filename: string; filePath: string }[] = [];

    for (let i = 0; i < uploadedFiles.length; i++) {
      const f = uploadedFiles[i];
      const savedFilename = generateFilename(
        userFolder,
        bill.billNumber || id,
        dateStr,
        `_${i}`,
        f.originalFilename || ''
      );
      const relPath = `${userFolder}/${savedFilename}`;
      const savedFilePath = path.join(UPLOADS_DIR, relPath);

      fs.renameSync(f.filepath, savedFilePath);
      movedFilePaths.push(savedFilePath);
      stored.push({ id: crypto.randomUUID(), filename: f.originalFilename || '', filePath: relPath });
    }

    // Count check + insert in one serializable transaction so concurrent
    // uploads can't push the bill past the image cap. New images are appended
    // after the current highest sortOrder.
    const newImages = await runSerializable(async (tx) => {
      const existing = await tx.billImage.aggregate({
        where: { billId: id },
        _count: { _all: true },
        _max: { sortOrder: true },
      });
      if (existing._count._all + stored.length > MAX_IMAGES_PER_BILL) {
        throw new TooManyImagesError();
      }

      const firstSortOrder = (existing._max.sortOrder ?? -1) + 1;
      const rows = stored.map((img, i) => ({
        id: img.id,
        billId: id,
        filename: img.filename,
        filePath: img.filePath,
        sortOrder: firstSortOrder + i,
      }));
      await tx.billImage.createMany({ data: rows });

      // Update legacy columns with first image
      await syncLegacyImageColumns(tx, id);

      // Log image addition
      await tx.editLog.create({
        data: {
          projectId,
          timestamp: new Date(),
          user: session.user.email,
          billId: id,
          changes: { images: `added ${rows.length}` },
          source: 'user',
        },
      });

      return rows.map((r) => ({
        id: r.id,
        filename: r.filename || undefined,
        file: r.filePath,
        sortOrder: r.sortOrder,
      }));
    });

    return NextResponse.json({ ok: true, images: newImages });
  } catch (error) {
    cleanupFiles();

    const uploadResponse = uploadErrorResponse(error);
    if (uploadResponse) return uploadResponse;

    if (error instanceof TooManyImagesError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error adding images:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
