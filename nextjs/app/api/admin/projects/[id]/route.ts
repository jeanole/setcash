// ============================================================================
// Admin Project API - PATCH (update uploadLimit) + DELETE (cascade delete)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { UPLOADS_DIR } from '@/lib/upload';

const patchProjectSchema = z.object({
  uploadLimit: z.number().int().min(1).nullable(),
});

// PATCH /api/admin/projects/[id] - Update project uploadLimit
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    const body = await req.json();
    const parsed = patchProjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const updated = await prisma.project.update({
      where: { id },
      data: { uploadLimit: parsed.data.uploadLimit },
    });

    return NextResponse.json({ ok: true, uploadLimit: updated.uploadLimit });
  } catch (error) {
    console.error('Error updating project:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/admin/projects/[id] - Delete project with cascade cleanup
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is super-admin
    if (session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    // Check if project exists
    const project = await prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Collect all bill image file paths BEFORE the DB rows are deleted, so we
    // can remove the corresponding files from disk once the transaction has
    // committed. The Bill.filename column is only ever a copy of the first
    // BillImage's filename (not a standalone path), so BillImage.filePath is
    // the sole source of truth for on-disk locations.
    const imagesToDelete = await prisma.billImage.findMany({
      where: { bill: { projectId: id } },
      select: { filePath: true },
    });

    // Delete all related records explicitly inside a single transaction
    await prisma.$transaction([
      // Bills (cascade will handle billImages, billMotives, billCategories, editLogs, ocrLogs)
      prisma.bill.deleteMany({ where: { projectId: id } }),
      // Motives (cascade will handle billMotives, budgetMatrix)
      prisma.motive.deleteMany({ where: { projectId: id } }),
      // Categories (cascade will handle billCategories, budgetMatrix)
      prisma.category.deleteMany({ where: { projectId: id } }),
      // Vgeld
      prisma.vgeld.deleteMany({ where: { projectId: id } }),
      // EditLog entries not associated with bills (bill-related already deleted)
      prisma.editLog.deleteMany({ where: { projectId: id } }),
      // BudgetMatrix
      prisma.budgetMatrix.deleteMany({ where: { projectId: id } }),
      // Delete project (cascade handles members, positions, settings, notifications, telegramLinks)
      prisma.project.delete({ where: { id } }),
    ]);

    // Remove the bill image files from disk now that the DB rows are gone.
    // Per-file failures are logged but never fail the request — the DB state
    // is already committed and is the source of truth.
    await Promise.all(
      imagesToDelete.map(async (img) => {
        if (!img.filePath) return;
        const fullPath = path.join(UPLOADS_DIR, img.filePath);
        try {
          await fs.promises.unlink(fullPath);
        } catch (e) {
          console.error('Failed to delete bill image file during project deletion:', e);
        }
      })
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error deleting project:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
