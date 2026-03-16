// ============================================================================
// Bill API - GET / PUT / DELETE
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';
import { z } from 'zod';
import * as storage from '@/lib/storage';

// Validation schemas
const updateBillSchema = z.object({
  date: z.string().datetime().optional(),
  type: z.string().optional(),
  vendor: z.string().optional(),
  item: z.string().optional(),
  comment: z.string().optional(),
  brutto19: z.number().min(0).optional(),
  brutto7: z.number().min(0).optional(),
  brutto0: z.number().min(0).optional(),
  motiveAllocations: z.array(z.object({
    motiveId: z.string(),
    percentage: z.number().min(0).max(100),
  })).optional(),
  categoryAllocations: z.array(z.object({
    categoryId: z.string(),
    percentage: z.number().min(0).max(100),
  })).optional(),
});

// Save allocations for a bill
async function saveAllocations(
  billId: string,
  motiveAllocations: { motiveId: string; percentage: number }[],
  categoryAllocations: { categoryId: string; percentage: number }[],
  projectId: string
) {
  // Delete existing allocations
  await prisma.billMotive.deleteMany({ where: { billId } });
  await prisma.billCategory.deleteMany({ where: { billId } });

  // Get default IDs
  const uncatMotive = await prisma.motive.findFirst({
    where: { name: 'Default', projectId },
  });
  const uncatCategory = await prisma.category.findFirst({
    where: { name: 'Uncategorized', projectId },
  });

  // Save motive allocations
  if (motiveAllocations.length > 0) {
    let totalPct = 0;
    for (const a of motiveAllocations) {
      if (a.percentage > 0) {
        await prisma.billMotive.create({
          data: {
            billId,
            motiveId: a.motiveId,
            percentage: a.percentage,
          },
        });
        totalPct += a.percentage;
      }
    }
    // Fill remaining with default
    if (totalPct < 100 && uncatMotive) {
      await prisma.billMotive.create({
        data: {
          billId,
          motiveId: uncatMotive.id,
          percentage: 100 - totalPct,
        },
      });
    }
  } else if (uncatMotive) {
    // No allocations, 100% to default
    await prisma.billMotive.create({
      data: {
        billId,
        motiveId: uncatMotive.id,
        percentage: 100,
      },
    });
  }

  // Save category allocations
  if (categoryAllocations.length > 0) {
    let totalPct = 0;
    for (const a of categoryAllocations) {
      if (a.percentage > 0) {
        await prisma.billCategory.create({
          data: {
            billId,
            categoryId: a.categoryId,
            percentage: a.percentage,
          },
        });
        totalPct += a.percentage;
      }
    }
    // Fill remaining with uncategorized
    if (totalPct < 100 && uncatCategory) {
      await prisma.billCategory.create({
        data: {
          billId,
          categoryId: uncatCategory.id,
          percentage: 100 - totalPct,
        },
      });
    }
  } else if (uncatCategory) {
    // No allocations, 100% to uncategorized
    await prisma.billCategory.create({
      data: {
        billId,
        categoryId: uncatCategory.id,
        percentage: 100,
      },
    });
  }
}

// Helper to build motive display string
async function getMotiveDisplayString(billId: string): Promise<string> {
  const allocs = await prisma.billMotive.findMany({
    where: { billId },
    include: { motive: { select: { name: true } } },
  });

  if (allocs.length === 0) return '';
  if (allocs.length === 1 && Number(allocs[0].percentage) === 100) {
    return allocs[0].motive.name;
  }
  return allocs.map((a) => `${a.motive.name} (${Number(a.percentage)}%)`).join(', ');
}

// Sync legacy bills.filename with first image
async function syncLegacyImageColumns(billId: string) {
  const firstImage = await prisma.billImage.findFirst({
    where: { billId },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });

  if (firstImage) {
    await prisma.bill.update({
      where: { id: billId },
      data: {
        filename: firstImage.filename,
      },
    });
  } else {
    await prisma.bill.update({
      where: { id: billId },
      data: { filename: '' },
    });
  }
}

// GET /api/bills/[id] - Get single bill
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

    // Get bill with related data
    const bill = await prisma.bill.findFirst({
      where: {
        id,
        projectId,
      },
      include: {
        images: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        },
        motives: {
          include: {
            motive: { select: { name: true } },
          },
        },
        categories: {
          include: {
            category: { select: { name: true } },
          },
        },
      },
    });

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    // Get user role
    const membership = await prisma.projectMember.findFirst({
      where: {
        projectId,
        userEmail: bill.submittedByEmail,
      },
      include: {
        position: { select: { name: true } },
      },
    });

    const mapped = {
      id: bill.id,
      date: bill.date.toISOString(),
      email: bill.submittedByEmail,
      role: membership?.position?.name || 'Misc',
      billNumber: bill.billNumber,
      type: bill.type,
      vendor: bill.vendor,
      item: bill.item,
      comment: bill.comment,
      motive: bill.motiveLegacy,
      brutto19: Number(bill.brutto19),
      brutto7: Number(bill.brutto7),
      brutto0: Number(bill.brutto0),
      amount: Number(bill.grossAmount),
      netto19: Number(bill.brutto19) / 1.19,
      netto7: Number(bill.brutto7) / 1.07,
      netto0: Number(bill.brutto0),
      nettoAmount: Number(bill.nettoAmount),
      filename: bill.filename,
      images: await Promise.all(bill.images.map(async (img) => ({
        id: img.id,
        filename: img.filename,
        file: await storage.getFileUrl(img.filePath),
        sortOrder: img.sortOrder,
      }))),
      motiveAllocations: bill.motives.map((m) => ({
        id: m.id,
        motiveId: m.motiveId,
        name: m.motive.name,
        percentage: Number(m.percentage),
      })),
      categoryAllocations: bill.categories.map((c) => ({
        id: c.id,
        categoryId: c.categoryId,
        name: c.category.name,
        percentage: Number(c.percentage),
      })),
      status: bill.status,
      ocrStatus: bill.ocrStatus,
      ocrFields: bill.ocrFields as string[] | null,
    };

    return NextResponse.json(mapped);
  } catch (error) {
    console.error('Error fetching bill:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/bills/[id] - Update bill
export async function PUT(
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

    // Get existing bill
    const bill = await prisma.bill.findFirst({
      where: { id, projectId },
    });

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    // Check permissions - only submitter, project admin/owner, or superadmin can update
    const isOwner = bill.submittedByEmail.toLowerCase() === session.user.email.toLowerCase();
    const isAdmin =
      session.user.role === 'admin' ||
      session.user.role === 'owner' ||
      session.user.role === 'superadmin';
    
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const validation = updateBillSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data = validation.data;
    const changes: Record<string, unknown> = {};
    const updates: Record<string, unknown> = {};

    // Track field changes
    if (data.date !== undefined && data.date !== bill.date.toISOString()) {
      changes.date = data.date;
      updates.date = new Date(data.date);
    }
    if (data.type !== undefined && data.type !== bill.type) {
      changes.type = data.type;
      updates.type = data.type;
    }
    if (data.vendor !== undefined && data.vendor !== bill.vendor) {
      changes.vendor = data.vendor;
      updates.vendor = data.vendor;
    }
    if (data.item !== undefined && data.item !== bill.item) {
      changes.item = data.item;
      updates.item = data.item;
    }
    if (data.comment !== undefined && data.comment !== bill.comment) {
      changes.comment = data.comment;
      updates.comment = data.comment;
    }
    if (data.brutto19 !== undefined && data.brutto19 !== Number(bill.brutto19)) {
      changes.brutto19 = data.brutto19;
      updates.brutto19 = data.brutto19;
    }
    if (data.brutto7 !== undefined && data.brutto7 !== Number(bill.brutto7)) {
      changes.brutto7 = data.brutto7;
      updates.brutto7 = data.brutto7;
    }
    if (data.brutto0 !== undefined && data.brutto0 !== Number(bill.brutto0)) {
      changes.brutto0 = data.brutto0;
      updates.brutto0 = data.brutto0;
    }

    // Auto-promote draft to confirmed when vendor and amount are both present
    let newStatus = bill.status;
    if (bill.status === 'draft' as const) {
      const newVendor = data.vendor !== undefined ? data.vendor : bill.vendor || '';
      const newB19 = data.brutto19 !== undefined ? data.brutto19 : Number(bill.brutto19) || 0;
      const newB7 = data.brutto7 !== undefined ? data.brutto7 : Number(bill.brutto7) || 0;
      const newB0 = data.brutto0 !== undefined ? data.brutto0 : Number(bill.brutto0) || 0;
      
      if (newVendor.trim() !== '' && newB19 + newB7 + newB0 > 0) {
        changes.status = 'confirmed';
        newStatus = 'confirmed';
        updates.status = 'confirmed';
      }
    }

    // Recalculate totals if amounts changed
    const newB19 = data.brutto19 !== undefined ? data.brutto19 : Number(bill.brutto19);
    const newB7 = data.brutto7 !== undefined ? data.brutto7 : Number(bill.brutto7);
    const newB0 = data.brutto0 !== undefined ? data.brutto0 : Number(bill.brutto0);
    
    if (data.brutto19 !== undefined || data.brutto7 !== undefined || data.brutto0 !== undefined) {
      updates.grossAmount = newB19 + newB7 + newB0;
      updates.nettoAmount = newB19 / 1.19 + newB7 / 1.07 + newB0;
    }

    // Strip OCR-suggested fields that user has explicitly edited
    if (bill.ocrFields) {
      let ocrFields = bill.ocrFields as string[];
      const editedFields = Object.keys(changes);
      const bruttoFields = ['brutto19', 'brutto7', 'brutto0'];
      const anyBruttoEdited = bruttoFields.some((f) => editedFields.includes(f));
      const fieldsToRemove = anyBruttoEdited ? [...editedFields, 'amount'] : editedFields;
      
      ocrFields = ocrFields.filter((f) => !fieldsToRemove.includes(f));
      
      if (ocrFields.length === 0) {
        updates.ocrFields = null;
        updates.ocrStatus = null;
      } else {
        updates.ocrFields = ocrFields;
      }
    }

    // Save allocations if provided
    if (data.motiveAllocations !== undefined || data.categoryAllocations !== undefined) {
      await saveAllocations(
        id,
        data.motiveAllocations || [],
        data.categoryAllocations || [],
        projectId
      );
      
      // Update legacy motive column
      const motiveStr = await getMotiveDisplayString(id);
      if (motiveStr !== bill.motiveLegacy) {
        changes.motive = motiveStr;
        updates.motiveLegacy = motiveStr;
      }
    }

    // Apply updates if there are changes
    if (Object.keys(updates).length > 0) {
      await prisma.bill.update({
        where: { id },
        data: updates,
      });
    }

    // Log the edit if there are field changes or allocation changes
    if (Object.keys(changes).length > 0 || data.motiveAllocations !== undefined || data.categoryAllocations !== undefined) {
      await prisma.editLog.create({
        data: {
          projectId,
          timestamp: new Date(),
          user: session.user.email,
          billId: id,
          changes: (Object.keys(changes).length > 0 ? changes : { allocations: 'updated' }) as never,
          source: 'user',
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error updating bill:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/bills/[id] - Delete bill
export async function DELETE(
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

    // Get existing bill
    const bill = await prisma.bill.findFirst({
      where: { id, projectId },
      include: { images: true },
    });

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    // Check permissions - only owner or admin can delete
    const isOwner = bill.submittedByEmail.toLowerCase() === session.user.email.toLowerCase();
    const isAdmin = session.user.role === 'admin' || session.user.role === 'owner' || session.user.role === 'superadmin';

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Clean up image files
    for (const img of bill.images) {
      if (img.filePath) {
        await storage.deleteFile(img.filePath);
      }
    }

    // Delete bill (cascades to images, motives, categories via Prisma)
    await prisma.bill.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error deleting bill:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
