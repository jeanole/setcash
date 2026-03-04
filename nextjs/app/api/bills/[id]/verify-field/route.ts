// ============================================================================
// Bill Verify Field API - PATCH
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';
import { z } from 'zod';

const ALLOWED_OCR_FIELDS = ['date', 'vendor', 'item', 'type', 'brutto19', 'brutto7', 'brutto0', 'amount', 'comment'];

const verifyFieldSchema = z.object({
  field: z.enum(['date', 'vendor', 'item', 'type', 'brutto19', 'brutto7', 'brutto0', 'amount', 'comment']),
});

// PATCH /api/bills/[id]/verify-field - Verify/reject OCR field
export async function PATCH(
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
      select: { id: true, ocrFields: true, ocrStatus: true },
    });

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    const body = await req.json();
    const validation = verifyFieldSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid field name' },
        { status: 400 }
      );
    }

    const { field } = validation.data;

    let ocrFields: string[] = [];
    try {
      ocrFields = (bill.ocrFields as string[]) || [];
    } catch {}

    if (!ocrFields.includes(field)) {
      return NextResponse.json(
        { error: 'Field is not in ocr_fields' },
        { status: 400 }
      );
    }

    let remaining = ocrFields.filter((f) => f !== field);
    // "amount" is a computed field not shown in the UI - auto-clear it if it's the only one left
    if (remaining.length === 1 && remaining[0] === 'amount') {
      remaining = [];
    }

    if (remaining.length === 0) {
      await prisma.bill.update({
        where: { id },
        data: {
          ocrFields: undefined,
          ocrStatus: undefined,
        },
      });
    } else {
      await prisma.bill.update({
        where: { id },
        data: {
          ocrFields: remaining,
        },
      });
    }

    // Log the verification
    await prisma.editLog.create({
      data: {
        projectId,
        timestamp: new Date(),
        user: session.user.email,
        billId: id,
        changes: { _event: 'verified', field },
        source: 'user',
      },
    });

    return NextResponse.json({
      ok: true,
      ocrFields: remaining.length > 0 ? remaining : null,
      ocrStatus: remaining.length > 0 ? 'done' : null,
    });
  } catch (error) {
    console.error('Error verifying field:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
