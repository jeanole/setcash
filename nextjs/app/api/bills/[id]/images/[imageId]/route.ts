// ============================================================================
// Bill Image API - PUT / DELETE
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';
import path from 'path';
import fs from 'fs';
import type { File } from 'formidable';
import {
  parseForm,
  getUploadedFile,
  ensureUploadDir,
  generateFilename,
  validateFile,
  uploadErrorResponse,
  UPLOADS_DIR,
} from '@/lib/upload';
import { verifyAdminRole } from '@/lib/auth-guard';
import { billImageUploadLimiter } from '@/lib/ratelimit';
import { imageEditLockResponse, syncLegacyImageColumns } from '@/app/api/bills/_lib/shared';

// Best-effort removal of a stored upload (path relative to UPLOADS_DIR)
function removeStoredFile(filePath: string) {
  if (!filePath) return;
  const root = path.resolve(UPLOADS_DIR);
  const resolved = path.resolve(root, filePath);
  if (!resolved.startsWith(root + path.sep)) return;
  try {
    if (fs.existsSync(resolved)) fs.unlinkSync(resolved);
  } catch (e) {
    console.error('Failed to delete image file:', e);
  }
}

// PUT /api/bills/[id]/images/[imageId] - Replace/crop image
export async function PUT(
  req: NextRequest,
  props: { params: Promise<{ id: string; imageId: string }> }
) {
  const params = await props.params;
  let uploadedFile: File | null = null;
  let newFilePath: string | null = null; // absolute path of the stored replacement

  const cleanupNewFiles = () => {
    if (uploadedFile?.filepath && fs.existsSync(uploadedFile.filepath)) {
      try { fs.unlinkSync(uploadedFile.filepath); } catch { /* best-effort cleanup */ }
    }
    if (newFilePath && fs.existsSync(newFilePath)) {
      try { fs.unlinkSync(newFilePath); } catch { /* best-effort cleanup */ }
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

    const { id, imageId } = params;

    // Get bill
    const bill = await prisma.bill.findFirst({
      where: { id, projectId },
    });

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    // Check permissions - only submitter, project admin/owner, or superadmin can replace images
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

    // Get image
    const image = await prisma.billImage.findFirst({
      where: { id: imageId, billId: id },
    });

    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    // Parse multipart form (single file, size-capped)
    const { files } = await parseForm(req, { maxFiles: 1 });

    // Get uploaded file
    uploadedFile = getUploadedFile(files, 'photo');

    if (!uploadedFile) {
      return NextResponse.json({ error: 'No file' }, { status: 400 });
    }

    // Same extension + magic-byte validation as a fresh upload
    const validation = validateFile(uploadedFile);
    if (!validation.valid) {
      cleanupNewFiles();
      return NextResponse.json({ error: validation.error || 'Invalid file' }, { status: 400 });
    }

    // Store the replacement under a NEW unique path (never overwrite in place:
    // the extension may change, and the old file stays intact until the DB
    // row points at the new one).
    const userFolder = ensureUploadDir(bill.submittedByEmail);
    const dateStr = new Date().toISOString().split('T')[0];
    const savedFilename = generateFilename(
      userFolder,
      bill.billNumber || id,
      dateStr,
      `_${image.sortOrder}`,
      uploadedFile.originalFilename || ''
    );
    const relPath = `${userFolder}/${savedFilename}`;
    newFilePath = path.join(UPLOADS_DIR, relPath);

    // Use copy+delete instead of rename to handle cross-device moves (EXDEV)
    fs.copyFileSync(uploadedFile.filepath, newFilePath);
    try { fs.unlinkSync(uploadedFile.filepath); } catch { /* temp cleanup, non-fatal */ }

    await prisma.$transaction(async (tx) => {
      await tx.billImage.update({
        where: { id: imageId },
        data: { filePath: relPath },
      });
      await syncLegacyImageColumns(tx, id);

      // Log the crop
      await tx.editLog.create({
        data: {
          projectId,
          timestamp: new Date(),
          user: session.user.email,
          billId: id,
          changes: { image: 'cropped' },
          source: 'user',
        },
      });
    });

    // The row now points at the new file — drop the old one
    removeStoredFile(image.filePath);

    return NextResponse.json({ ok: true });
  } catch (error) {
    cleanupNewFiles();

    const uploadResponse = uploadErrorResponse(error);
    if (uploadResponse) return uploadResponse;

    console.error('Error replacing image:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/bills/[id]/images/[imageId] - Delete single image
export async function DELETE(
  req: NextRequest,
  props: { params: Promise<{ id: string; imageId: string }> }
) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = session.user.currentProjectId;
    if (!projectId) {
      return NextResponse.json({ error: 'No project selected' }, { status: 400 });
    }

    const { id, imageId } = params;

    // Get bill
    const bill = await prisma.bill.findFirst({
      where: { id, projectId },
    });

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    // Check permissions - only submitter, project admin/owner, or superadmin can delete images
    const isOwnerDel = bill.submittedByEmail.toLowerCase() === session.user.email.toLowerCase();
    const sessionClaimsAdminDel =
      session.user.role === 'admin' ||
      session.user.role === 'owner' ||
      session.user.role === 'superadmin';

    if (!isOwnerDel && !sessionClaimsAdminDel) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // SEC-02: non-owners are relying on admin authority — re-verify against
    // the DB rather than trusting the (possibly stale) JWT claim.
    if (!isOwnerDel) {
      const guard = await verifyAdminRole(session.user.email, projectId);
      if (!guard.authorized) {
        return guard.response!;
      }
    }

    // Approved/paid bills: images are frozen unless the caller is a DB-verified admin
    const lockResponse = await imageEditLockResponse(bill.status, session.user.email, projectId);
    if (lockResponse) return lockResponse;

    // Get image
    const image = await prisma.billImage.findFirst({
      where: { id: imageId, billId: id },
    });

    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    // Delete the record, refresh legacy columns and log in one transaction;
    // the file is only removed once the DB change has committed.
    await prisma.$transaction(async (tx) => {
      await tx.billImage.delete({
        where: { id: imageId },
      });

      // Update legacy columns
      await syncLegacyImageColumns(tx, id);

      // Log the deletion
      await tx.editLog.create({
        data: {
          projectId,
          timestamp: new Date(),
          user: session.user.email,
          billId: id,
          changes: { image: 'deleted' },
          source: 'user',
        },
      });
    });

    removeStoredFile(image.filePath);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error deleting image:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
