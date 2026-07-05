// ============================================================================
// Budget Matrix Bulk Update API - POST
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { notifyProjectAdmins } from '@/lib/notifications';

const bulkUpdateSchema = z.object({
  updates: z.array(
    z.object({
      motiveId: z.string(),
      categoryId: z.string(),
      amount: z.number().min(0),
    })
  ).max(1000),
});

// POST /api/budget-matrix/bulk-update - Bulk update budget matrix cells
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = session.user.currentProjectId;
    if (!projectId) {
      return NextResponse.json({ error: 'No project selected' }, { status: 400 });
    }

    // Verify project access and admin/owner role
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userEmail: {
          projectId,
          userEmail: session.user.email,
        },
      },
    });

    const isSuperAdmin = session.user.role === 'superadmin';
    const isAdminOrOwner = membership?.role === 'admin' || membership?.role === 'owner';

    if (!isSuperAdmin && !isAdminOrOwner) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validated = bulkUpdateSchema.parse(body);

    // Validate that all motiveIds and categoryIds belong to the current project
    const distinctMotiveIds = [...new Set(validated.updates.map((u) => u.motiveId))];
    const distinctCategoryIds = [...new Set(validated.updates.map((u) => u.categoryId))];

    const [validMotives, validCategories] = await Promise.all([
      prisma.motive.findMany({
        where: { id: { in: distinctMotiveIds }, projectId },
        select: { id: true },
      }),
      prisma.category.findMany({
        where: { id: { in: distinctCategoryIds }, projectId },
        select: { id: true, name: true, budget: true },
      }),
    ]);

    if (validMotives.length !== distinctMotiveIds.length) {
      return NextResponse.json(
        { error: 'One or more motives do not belong to the current project' },
        { status: 400 }
      );
    }

    if (validCategories.length !== distinctCategoryIds.length) {
      return NextResponse.json(
        { error: 'One or more categories do not belong to the current project' },
        { status: 400 }
      );
    }

    // Perform bulk upsert for each cell
    const results = await prisma.$transaction(
      validated.updates.map((update) =>
        prisma.budgetMatrix.upsert({
          where: {
            projectId_motiveId_categoryId: {
              projectId,
              motiveId: update.motiveId,
              categoryId: update.categoryId,
            },
          },
          update: {
            amount: update.amount,
          },
          create: {
            projectId,
            motiveId: update.motiveId,
            categoryId: update.categoryId,
            amount: update.amount,
          },
        })
      )
    );

    // Audit trail: record who performed the bulk update and how many cells
    // were touched. This is deliberately outside/after the transaction and
    // wrapped in its own try/catch — a logging failure must never roll back
    // (or fail) an already-committed budget matrix update.
    try {
      await prisma.editLog.create({
        data: {
          projectId,
          timestamp: new Date(),
          user: session.user.email,
          billId: null,
          changes: {
            action: 'budget_matrix_bulk_update',
            updatedCount: results.length,
          } as never,
          source: 'user',
        },
      });
    } catch (e) {
      console.error('Failed to write EditLog for budget matrix bulk update:', e);
    }

    return NextResponse.json({
      success: true,
      updatedCount: results.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    // Handle foreign key constraint violations (motive/category deleted mid-session)
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2003') {
        return NextResponse.json(
          { error: 'Some items were modified by another user. Please refresh.' },
          { status: 409 }
        );
      }
      if (error.code === 'P2025') {
        return NextResponse.json(
          { error: 'Some items were modified by another user. Please refresh.' },
          { status: 409 }
        );
      }
    }

    console.error('Error updating budget matrix:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
