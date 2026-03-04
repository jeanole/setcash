// ============================================================================
// Bill OCR Status API - GET
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';

// GET /api/bills/[id]/ocr-status - Get OCR status
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = session.user.currentProjectId;
    if (!projectId) {
      return NextResponse.json({ error: 'No project selected' }, { status: 400 });
    }

    const { id } = params;

    // Verify bill belongs to this project
    const bill = await prisma.bill.findFirst({
      where: { id, projectId },
      select: { ocrStatus: true, ocrFields: true },
    });

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    let ocrFields: string[] | null = null;
    if (bill.ocrFields) {
      try {
        ocrFields = bill.ocrFields as string[];
      } catch {
        ocrFields = null;
      }
    }

    return NextResponse.json({
      ocrStatus: bill.ocrStatus || null,
      ocrFields,
    });
  } catch (error) {
    console.error('Error fetching OCR status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
