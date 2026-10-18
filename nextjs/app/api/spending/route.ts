// ============================================================================
// Spending API — GET /api/spending?tab=motive|category
// Used by the client-side retry/refetch in SpendingPageClient
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { verifyProjectMember } from '@/lib/auth-guard';
import {
  getSpendingByMotive,
  getSpendingByCategory,
  getSpendingTotals,
  getGrossOnlySummary,
} from '@/lib/spending';

const TabSchema = z.enum(['motive', 'category']).default('motive');

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

    // Defense in depth: JWT claims may be stale (e.g. removed member)
    const memberCheck = await verifyProjectMember(session.user.email, projectId);
    if (!memberCheck.authorized) {
      return memberCheck.response!;
    }

    const tabParsed = TabSchema.safeParse(req.nextUrl.searchParams.get('tab') ?? undefined);
    if (!tabParsed.success) {
      return NextResponse.json({ error: 'Invalid tab parameter' }, { status: 400 });
    }
    const tab = tabParsed.data;

    // Gross-only bills (no VAT breakdown) are missing from the netto figures
    if (tab === 'category') {
      const [items, grossOnly] = await Promise.all([
        getSpendingByCategory(projectId),
        getGrossOnlySummary(projectId),
      ]);
      const totals = getSpendingTotals(items);
      return NextResponse.json({ items, totals, grossOnly });
    }

    // Default: motive
    const [items, grossOnly] = await Promise.all([
      getSpendingByMotive(projectId),
      getGrossOnlySummary(projectId),
    ]);
    const totals = getSpendingTotals(items);
    return NextResponse.json({ items, totals, grossOnly });
  } catch (error) {
    console.error('Error fetching spending data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
