// ============================================================================
// GET /api/admin/export/images
// ============================================================================
// Exports all bill images as a ZIP file, organized in per-user folders.
// Port of routes/exports.js lines 314-388
// ============================================================================

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { UPLOADS_DIR } from '@/lib/upload';
import fs from 'fs';
import path from 'path';
import { PassThrough } from 'stream';
// @ts-ignore
import archiver from 'archiver';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = session.user.currentProjectId;
    if (!projectId) {
      return NextResponse.json({ error: 'No project selected' }, { status: 400 });
    }

    const isAdmin =
      session.user.role === 'superadmin' ||
      session.user.currentProjectRole === 'admin' ||
      session.user.currentProjectRole === 'owner';

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Query all bill images with bill details
    const images = await prisma.billImage.findMany({
      where: { bill: { projectId } },
      include: {
        bill: {
          select: {
            billNumber: true,
            vendor: true,
            submittedByEmail: true,
            date: true,
          },
        },
      },
      orderBy: [
        { bill: { submittedByEmail: 'asc' } },
        { billId: 'asc' },
        { sortOrder: 'asc' },
        { id: 'asc' },
      ],
    });

    if (images.length === 0) {
      return NextResponse.json({ error: 'No images to export' }, { status: 404 });
    }

    // Project settings for filename
    const settingsRaw = await prisma.projectSettings.findMany({ where: { projectId } });
    const settings: Record<string, string> = {};
    settingsRaw.forEach((s) => { if (s.value) settings[s.key] = s.value; });
    const projectName = settings['projectTitle'] ?? 'SetCash';

    const dateStr = new Date().toISOString().split('T')[0];
    const zipName = `${projectName.replace(/[^a-zA-Z0-9_-]/g, '_')}_images_${dateStr}.zip`;

    const pass = new PassThrough();
    const archive = archiver('zip', { zlib: { level: 5 } });

    archive.on('error', (err: Error) => {
      console.error('Archive error:', err);
      pass.destroy(err);
    });
    archive.pipe(pass);

    // Count images per bill for multi-image suffix
    const billImageCounts: Record<string, number> = {};
    for (const img of images) {
      billImageCounts[img.billId] = (billImageCounts[img.billId] || 0) + 1;
    }

    const billImageIndex: Record<string, number> = {};
    for (const img of images) {
      if (!img.filePath) continue;

      // Sanitize path — no directory traversal
      const safeName = path.basename(img.filePath);
      const subDir = path.dirname(img.filePath).replace(/\.\./g, '');
      const filePath = path.join(UPLOADS_DIR, subDir, safeName);

      if (!fs.existsSync(filePath)) continue;

      const username = (img.bill.submittedByEmail || 'unknown')
        .split('@')[0]
        .replace(/[^a-zA-Z0-9_\-]/g, '');

      const billNum = img.bill.billNumber || String(img.billId);
      const d = new Date(img.bill.date || 0);
      const datePart =
        String(d.getFullYear()).slice(2) +
        String(d.getMonth() + 1).padStart(2, '0') +
        String(d.getDate()).padStart(2, '0');

      const vendor = (img.bill.vendor || 'unknown')
        .replace(/[^a-zA-Z0-9_\- ]/g, '')
        .trim()
        .replace(/ /g, '-');

      const ext = path.extname(img.filename || img.filePath) || '.jpg';

      let fileName = `${username}_${billNum}_${datePart}_${vendor}`;
      if (billImageCounts[img.billId] > 1) {
        billImageIndex[img.billId] = (billImageIndex[img.billId] || 0) + 1;
        fileName += `_${String(billImageIndex[img.billId]).padStart(2, '0')}`;
      }
      fileName += ext;

      archive.file(filePath, { name: `${username}/${fileName}` });
    }

    archive.finalize();

    const readableStream = new ReadableStream({
      start(controller) {
        pass.on('data', (chunk: Buffer) => controller.enqueue(chunk));
        pass.on('end', () => controller.close());
        pass.on('error', (err: Error) => controller.error(err));
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipName}"`,
      },
    });
  } catch (error) {
    console.error('Image export error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
