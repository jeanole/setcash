// ============================================================================
// Spending API — GET /api/spending?tab=motive|category
// Used by the client-side retry/refetch in SpendingPageClient
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  getSpendingByMotive,
  getSpendingByCategory,
  getSpendingTotals,
} from '@/lib/spending';

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

    const tab = req.nextUrl.searchParams.get('tab') ?? 'motive';

    if (tab === 'category') {
      const items = await getSpendingByCategory(projectId);
      const totals = getSpendingTotals(items);
      return NextResponse.json({ items, totals });
    }

    // Default: motive
    const items = await getSpendingByMotive(projectId);
    const totals = getSpendingTotals(items);
    return NextResponse.json({ items, totals });
  } catch (error) {
    console.error('Error fetching spending data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
