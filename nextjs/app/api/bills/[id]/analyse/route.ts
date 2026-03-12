// ============================================================================
// Bill OCR Analysis API - POST
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';
import { runOcrJob } from '@/lib/ocr';
import { billAnalyseLimiter } from '@/lib/ratelimit';

// POST /api/bills/[id]/analyse - Trigger OCR analysis
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting: 5 requests per minute per user
    const identifier = session.user.id || session.user.email;
    const { success } = await billAnalyseLimiter.limit(identifier);
    if (!success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const projectId = session.user.currentProjectId;
    if (!projectId) {
      return NextResponse.json({ error: 'No project selected' }, { status: 400 });
    }

    // Check admin permission
    if (session.user.role !== 'admin' && session.user.role !== 'owner' && session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden - admin only' }, { status: 403 });
    }

    const { id } = params;

    // Verify bill belongs to this project
    const bill = await prisma.bill.findFirst({
      where: { id, projectId },
      select: { id: true, ocrStatus: true },
    });

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    // Prevent duplicate concurrent jobs
    if (bill.ocrStatus === 'pending') {
      return NextResponse.json(
        { error: 'Analysis already in progress for this bill' },
        { status: 409 }
      );
    }

    // Fire and forget - run OCR in background
    runOcrJob(id, projectId).catch((e) =>
      console.error(`[OCR] Unhandled error for bill #${id}:`, e.message)
    );

    return NextResponse.json(
      { ok: true, message: 'Analysis started' },
      { status: 202 }
    );
  } catch (error) {
    console.error('Error triggering OCR analysis:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
