// ============================================================================
// Budget Matrix Bulk Update API - POST
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const bulkUpdateSchema = z.object({
  updates: z.array(
    z.object({
      motiveId: z.string(),
      categoryId: z.string(),
      amount: z.number().min(0),
    })
  ),
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
    console.error('Error updating budget matrix:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
