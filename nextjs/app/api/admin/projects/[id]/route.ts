// ============================================================================
// Admin Project API - DELETE (cascade delete with cleanup)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';

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

    // Delete all related records explicitly
    // Bills (cascade will handle billImages, billMotives, billCategories, editLogs, ocrLogs)
    await prisma.bill.deleteMany({
      where: { projectId: id },
    });

    // Motives (cascade will handle billMotives, budgetMatrix)
    await prisma.motive.deleteMany({
      where: { projectId: id },
    });

    // Categories (cascade will handle billCategories, budgetMatrix)
    await prisma.category.deleteMany({
      where: { projectId: id },
    });

    // Vgeld
    await prisma.vgeld.deleteMany({
      where: { projectId: id },
    });

    // EditLog entries not associated with bills (bill-related already deleted)
    await prisma.editLog.deleteMany({
      where: { projectId: id },
    });

    // BudgetMatrix
    await prisma.budgetMatrix.deleteMany({
      where: { projectId: id },
    });

    // Delete project (cascade handles members, positions, settings, notifications, telegramLinks)
    await prisma.project.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error deleting project:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
