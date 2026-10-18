// ============================================================================
// Budget Matrix API - GET
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { getBudgetMatrixSpending } from '@/lib/spending';

// GET /api/budget-matrix - Get budget matrix data with spending calculations
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = session.user.currentProjectId;
    if (!projectId) {
      return NextResponse.json({ error: 'No project selected' }, { status: 400 });
    }

    // Verify project access
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userEmail: {
          projectId,
          userEmail: session.user.email,
        },
      },
    });

    if (!membership && session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch motives
    const motivesRaw = await prisma.motive.findMany({
      where: { projectId },
      select: { id: true, name: true, budget: true },
    });

    // Fetch categories
    const categoriesRaw = await prisma.category.findMany({
      where: { projectId },
      select: { id: true, name: true, budget: true },
    });

    // Fetch budget matrix cells
    const matrixCells = await prisma.budgetMatrix.findMany({
      where: { projectId },
      select: { motiveId: true, categoryId: true, amount: true },
    });

    // Sort motives: "Default" first, then alphabetical
    const motives = motivesRaw
      .map((m) => ({ id: m.id, name: m.name, budget: Number(m.budget) }))
      .sort((a, b) => {
        if (a.name === 'Default') return -1;
        if (b.name === 'Default') return 1;
        return a.name.localeCompare(b.name);
      });

    // Sort categories: "Uncategorized" first, then alphabetical
    const categories = categoriesRaw
      .map((c) => ({ id: c.id, name: c.name, budget: Number(c.budget) }))
      .sort((a, b) => {
        if (a.name === 'Uncategorized') return -1;
        if (b.name === 'Uncategorized') return 1;
        return a.name.localeCompare(b.name);
      });

    const roundToTwo = (value: number): number => Math.round(value * 100) / 100;

    // Build matrix lookup map: "{categoryId}_{motiveId}" -> amount
    const matrix: Record<string, number> = {};
    let grandTotal = 0;
    for (const cell of matrixCells) {
      const key = `${cell.categoryId}_${cell.motiveId}`;
      const amount = Number(cell.amount);
      matrix[key] = amount;
      grandTotal += amount;
    }

    // Spending (netto + brutto) for confirmed/approved/paid bills; brutto uses
    // the calculateTotal rule (grossAmount when the brutto sum is 0). Same
    // helper as the budget page and /api/spending.
    const spending = await getBudgetMatrixSpending(projectId);

    return NextResponse.json({
      motives,
      categories,
      matrix,
      grandTotal: roundToTwo(grandTotal),
      ...spending,
    });
  } catch (error) {
    console.error('Error fetching budget matrix:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
