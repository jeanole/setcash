// ============================================================================
// Bill Image API - PUT / DELETE
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';
import fs from 'fs';
import {
  parseForm,
  getUploadedFile,
} from '@/lib/upload';
import * as storage from '@/lib/storage';

// Sync legacy bills.filename with first image
async function syncLegacyImageColumns(billId: string) {
  const firstImage = await prisma.billImage.findFirst({
    where: { billId },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });

  if (firstImage) {
    await prisma.bill.update({
      where: { id: billId },
      data: {
        filename: firstImage.filename,
      },
    });
  } else {
    await prisma.bill.update({
      where: { id: billId },
      data: { filename: '' },
    });
  }
}

// PUT /api/bills/[id]/images/[imageId] - Replace/crop image
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; imageId: string } }
) {
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

    // Check permissions - only submitter, project admin/owner, or superadmin can replace images
    const isOwner = bill.submittedByEmail.toLowerCase() === session.user.email.toLowerCase();
    const isAdmin =
      session.user.role === 'admin' ||
      session.user.role === 'owner' ||
      session.user.role === 'superadmin';

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get image
    const image = await prisma.billImage.findFirst({
      where: { id: imageId, billId: id },
    });

    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    // Parse multipart form
    const { files } = await parseForm(req);

    // Get uploaded file
    const uploadedFile = getUploadedFile(files, 'photo');

    if (!uploadedFile) {
      return NextResponse.json({ error: 'No file' }, { status: 400 });
    }

    // Read temp file, upload via storage adapter (overwrites existing), then delete temp file
    const buffer = fs.readFileSync(uploadedFile.filepath);
    await storage.uploadFile(image.filePath, buffer);
    try { fs.unlinkSync(uploadedFile.filepath); } catch { /* temp cleanup, non-fatal */ }

    // Log the crop
    await prisma.editLog.create({
      data: {
        projectId,
        timestamp: new Date(),
        user: session.user.email,
        billId: id,
        changes: { image: 'cropped' },
        source: 'user',
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error replacing image:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/bills/[id]/images/[imageId] - Delete single image
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; imageId: string } }
) {
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
    const isAdminDel =
      session.user.role === 'admin' ||
      session.user.role === 'owner' ||
      session.user.role === 'superadmin';

    if (!isOwnerDel && !isAdminDel) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get image
    const image = await prisma.billImage.findFirst({
      where: { id: imageId, billId: id },
    });

    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    // Delete file from storage
    if (image.filePath) {
      await storage.deleteFile(image.filePath);
    }

    // Delete image record
    await prisma.billImage.delete({
      where: { id: imageId },
    });

    // Update legacy columns
    await syncLegacyImageColumns(id);

    // Log the deletion
    await prisma.editLog.create({
      data: {
        projectId,
        timestamp: new Date(),
        user: session.user.email,
        billId: id,
        changes: { image: 'deleted' },
        source: 'user',
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error deleting image:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
