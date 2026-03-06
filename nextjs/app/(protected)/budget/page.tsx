import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import BudgetMatrixClient from '@/components/budget/BudgetMatrixClient';
import SettingsSection from '@/components/settings/SettingsSection';
import type { BudgetMatrixResponse, Motive, Category } from '@/lib/types';

async function getBudgetMatrixData(projectId: string): Promise<BudgetMatrixResponse> {
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
  const motives: Motive[] = motivesRaw
    .map((m) => ({ id: m.id, name: m.name, budget: Number(m.budget) }))
    .sort((a, b) => {
      if (a.name === 'Default') return -1;
      if (b.name === 'Default') return 1;
      return a.name.localeCompare(b.name);
    });

  // Sort categories: "Uncategorized" first, then alphabetical
  const categories: Category[] = categoriesRaw
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
  // Note: PostgreSQL with Prisma uses camelCase column names
  // Motive spending
  const motiveSpendingRaw = await prisma.$queryRaw<{ motiveId: string; spent: number }[]>`
    SELECT bm."motiveId", SUM(b."nettoAmount" * bm.percentage / 100) as spent
    FROM "BillMotive" bm 
    JOIN "Bill" b ON b.id = bm."billId"
    WHERE b."projectId" = ${projectId}
      AND b.status NOT IN ('draft'::"BillStatus", 'pending'::"BillStatus", 'rejected'::"BillStatus")
    GROUP BY bm."motiveId"
  `;

  // Category spending
  const categorySpendingRaw = await prisma.$queryRaw<{ categoryId: string; spent: number }[]>`
    SELECT bc."categoryId", SUM(b."nettoAmount" * bc.percentage / 100) as spent
    FROM "BillCategory" bc 
    JOIN "Bill" b ON b.id = bc."billId"
    WHERE b."projectId" = ${projectId}
      AND b.status NOT IN ('draft'::"BillStatus", 'pending'::"BillStatus", 'rejected'::"BillStatus")
    GROUP BY bc."categoryId"
  `;

  // Cell spending (motive + category intersection)
  const cellSpendingRaw = await prisma.$queryRaw<{ motiveId: string; categoryId: string; spent: number }[]>`
    SELECT bm."motiveId", bc."categoryId",
      SUM(b."nettoAmount" * bm.percentage / 100 * bc.percentage / 100) as spent
    FROM "BillMotive" bm
    JOIN "BillCategory" bc ON bc."billId" = bm."billId"
    JOIN "Bill" b ON b.id = bm."billId"
    WHERE b."projectId" = ${projectId}
      AND b.status NOT IN ('draft'::"BillStatus", 'pending'::"BillStatus", 'rejected'::"BillStatus")
    GROUP BY bm."motiveId", bc."categoryId"
  `;

  // Convert spending results to lookup maps with 2-decimal precision
  const roundToTwo = (value: number): number => Math.round(value * 100) / 100;

  const motiveSpending: Record<string, number> = {};
  for (const row of motiveSpendingRaw) {
    motiveSpending[row.motiveId] = roundToTwo(Number(row.spent));
  }

  const categorySpending: Record<string, number> = {};
  for (const row of categorySpendingRaw) {
    categorySpending[row.categoryId] = roundToTwo(Number(row.spent));
  }

  const cellSpending: Record<string, number> = {};
  for (const row of cellSpendingRaw) {
    const key = `${row.categoryId}_${row.motiveId}`;
    cellSpending[key] = roundToTwo(Number(row.spent));
  }

  return {
    motives,
    categories,
    matrix,
    grandTotal,
    motiveSpending,
    categorySpending,
    cellSpending,
  };
}

export default async function BudgetPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const projectId = session.user.currentProjectId;

  if (!projectId) {
    redirect('/settings/projects');
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
    redirect('/dashboard');
  }

  // Check if user is admin/owner for edit permissions
  const projectRole = session.user.currentProjectRole;
  const isAdmin = projectRole === 'admin' || projectRole === 'owner' || session.user.role === 'superadmin';

  // Fetch budget matrix data
  const data = await getBudgetMatrixData(projectId);

  return (
    <div className="p-6 max-w-[1600px] mx-auto bg-[var(--vb-content-bg)]">
      <SettingsSection
        title="Budget Matrix"
        description="Manage your budget allocation across motives and categories. Click on any cell to edit the budget amount."
      >
        <BudgetMatrixClient {...data} isAdmin={isAdmin} />
      </SettingsSection>
    </div>
  );
}
