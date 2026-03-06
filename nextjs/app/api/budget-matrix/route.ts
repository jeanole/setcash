// ============================================================================
// Budget Matrix API - GET
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

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

    // Build matrix lookup map: "{categoryId}_{motiveId}" -> amount
    const matrix: Record<string, number> = {};
    let grandTotal = 0;
    for (const cell of matrixCells) {
      const key = `${cell.categoryId}_${cell.motiveId}`;
      const amount = Number(cell.amount);
      matrix[key] = amount;
      grandTotal += amount;
    }

    // Calculate spending using raw SQL queries
    // Motive spending
    const motiveSpendingRaw = await prisma.$queryRaw<{ motive_id: string; spent: number }[]>`
      SELECT bm.motive_id, SUM(b.netto_amount * bm.percentage / 100) as spent
      FROM "BillMotive" bm 
      JOIN "Bill" b ON b.id = bm.bill_id
      WHERE b.project_id = ${projectId}
        AND b.status NOT IN ('draft', 'pending', 'rejected')
      GROUP BY bm.motive_id
    `;

    // Category spending
    const categorySpendingRaw = await prisma.$queryRaw<{ category_id: string; spent: number }[]>`
      SELECT bc.category_id, SUM(b.netto_amount * bc.percentage / 100) as spent
      FROM "BillCategory" bc 
      JOIN "Bill" b ON b.id = bc.bill_id
      WHERE b.project_id = ${projectId}
        AND b.status NOT IN ('draft', 'pending', 'rejected')
      GROUP BY bc.category_id
    `;

    // Cell spending (motive + category intersection)
    const cellSpendingRaw = await prisma.$queryRaw<{ motive_id: string; category_id: string; spent: number }[]>`
      SELECT bm.motive_id, bc.category_id,
        SUM(b.netto_amount * bm.percentage / 100 * bc.percentage / 100) as spent
      FROM "BillMotive" bm
      JOIN "BillCategory" bc ON bc.bill_id = bm.bill_id
      JOIN "Bill" b ON b.id = bm.bill_id
      WHERE b.project_id = ${projectId}
        AND b.status NOT IN ('draft', 'pending', 'rejected')
      GROUP BY bm.motive_id, bc.category_id
    `;

    // Convert spending results to lookup maps
    const motiveSpending: Record<string, number> = {};
    for (const row of motiveSpendingRaw) {
      motiveSpending[row.motive_id] = Number(row.spent);
    }

    const categorySpending: Record<string, number> = {};
    for (const row of categorySpendingRaw) {
      categorySpending[row.category_id] = Number(row.spent);
    }

    const cellSpending: Record<string, number> = {};
    for (const row of cellSpendingRaw) {
      const key = `${row.category_id}_${row.motive_id}`;
      cellSpending[key] = Number(row.spent);
    }

    return NextResponse.json({
      motives,
      categories,
      matrix,
      grandTotal,
      motiveSpending,
      categorySpending,
      cellSpending,
    });
  } catch (error) {
    console.error('Error fetching budget matrix:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
