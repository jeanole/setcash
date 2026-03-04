// ============================================================================
// Bill Images API - POST
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';
import path from 'path';
import fs from 'fs';
import {
  parseForm,
  getUploadedFiles,
  ensureUploadDir,
  generateFilename,
  UPLOADS_DIR,
} from '@/lib/upload';

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

// POST /api/bills/[id]/images - Add images to existing bill
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
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

    const { id } = params;

    // Get bill
    const bill = await prisma.bill.findFirst({
      where: { id, projectId },
    });

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    // Parse multipart form
    const { fields, files } = await parseForm(req);

    // Get uploaded files
    const uploadedFiles = getUploadedFiles(files, 'photos');

    if (uploadedFiles.length === 0) {
      return NextResponse.json({ error: 'No files' }, { status: 400 });
    }

    // Check current image count
    const currentCount = await prisma.billImage.count({
      where: { billId: id },
    });

    if (currentCount + uploadedFiles.length > 10) {
      return NextResponse.json(
        { error: 'Maximum 10 images per bill' },
        { status: 400 }
      );
    }

    const userFolder = ensureUploadDir(bill.submittedByEmail);
    const dateStr = new Date().toISOString().split('T')[0];
    const newImages = [];

    for (let i = 0; i < uploadedFiles.length; i++) {
      const f = uploadedFiles[i];
      const ext = path.extname(f.originalFilename || '') || '.jpg';
      const sortOrder = currentCount + i;
      const savedFilename = generateFilename(
        userFolder,
        bill.billNumber || id,
        dateStr,
        `_${sortOrder}`,
        f.originalFilename || ''
      );
      const relPath = `${userFolder}/${savedFilename}`;
      const savedFilePath = path.join(UPLOADS_DIR, relPath);

      // Move file to final location
      fs.renameSync(f.filepath, savedFilePath);

      // Create image record
      const img = await prisma.billImage.create({
        data: {
          billId: id,
          filename: f.originalFilename || '',
          filePath: relPath,
          sortOrder,
        },
      });

      newImages.push({
        id: img.id,
        filename: f.originalFilename,
        file: relPath,
        sortOrder,
      });
    }

    // Update legacy columns with first image
    await syncLegacyImageColumns(id);

    // Log image addition
    await prisma.editLog.create({
      data: {
        projectId,
        timestamp: new Date(),
        user: session.user.email,
        billId: id,
        changes: { images: `added ${uploadedFiles.length}` },
        source: 'user',
      },
    });

    return NextResponse.json({ ok: true, images: newImages });
  } catch (error) {
    console.error('Error adding images:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
