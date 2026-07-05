// ============================================================================
// Bill API - GET / PUT / DELETE
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import { UPLOADS_DIR } from '@/lib/upload';
import { verifyAdminRole } from '@/lib/auth-guard';

// Small float slack for allocation-sum validation
const ALLOCATION_SUM_EPSILON = 0.01;

// Validation schemas
const updateBillSchema = z
  .object({
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
  })
  .superRefine((data, ctx) => {
    if (data.motiveAllocations) {
      const sum = data.motiveAllocations.reduce((acc, a) => acc + a.percentage, 0);
      if (sum > 100 + ALLOCATION_SUM_EPSILON) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Motive allocations sum to more than 100%',
          path: ['motiveAllocations'],
        });
      }
    }
    if (data.categoryAllocations) {
      const sum = data.categoryAllocations.reduce((acc, a) => acc + a.percentage, 0);
      if (sum > 100 + ALLOCATION_SUM_EPSILON) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Category allocations sum to more than 100%',
          path: ['categoryAllocations'],
        });
      }
    }
  });

// Save allocations for a bill.
// Rejects with a thrown Error (caller must return 400) if any supplied
// motiveId/categoryId does not belong to the given project — this indicates
// tampering or a client bug and must not be silently dropped.
async function saveAllocations(
  billId: string,
  motiveAllocations: { motiveId: string; percentage: number }[],
  categoryAllocations: { categoryId: string; percentage: number }[],
  projectId: string,
  client: typeof prisma = prisma
) {
  // --- Cross-project injection guard (Task 1) ---
  // Batch-fetch valid IDs scoped to this project, mirroring the pattern in
  // budget-matrix/bulk-update/route.ts.
  const distinctMotiveIds = [...new Set(motiveAllocations.map((a) => a.motiveId))];
  const distinctCategoryIds = [...new Set(categoryAllocations.map((a) => a.categoryId))];

  if (distinctMotiveIds.length > 0) {
    const validMotives = await client.motive.findMany({
      where: { id: { in: distinctMotiveIds }, projectId },
      select: { id: true },
    });
    const validMotiveSet = new Set(validMotives.map((m) => m.id));
    if (validMotives.length !== distinctMotiveIds.length) {
      const invalid = distinctMotiveIds.filter((id) => !validMotiveSet.has(id));
      throw new Error(`Invalid motive/category for this project (motiveIds: ${invalid.join(', ')})`);
    }
  }

  if (distinctCategoryIds.length > 0) {
    const validCategories = await client.category.findMany({
      where: { id: { in: distinctCategoryIds }, projectId },
      select: { id: true },
    });
    const validCategorySet = new Set(validCategories.map((c) => c.id));
    if (validCategories.length !== distinctCategoryIds.length) {
      const invalid = distinctCategoryIds.filter((id) => !validCategorySet.has(id));
      throw new Error(`Invalid motive/category for this project (categoryIds: ${invalid.join(', ')})`);
    }
  }
  // --- End cross-project guard ---

  // Delete existing allocations
  await client.billMotive.deleteMany({ where: { billId } });
  await client.billCategory.deleteMany({ where: { billId } });

  // Get default IDs
  const uncatMotive = await client.motive.findFirst({
    where: { name: 'Default', projectId },
  });
  const uncatCategory = await client.category.findFirst({
    where: { name: 'Uncategorized', projectId },
  });

  // Save motive allocations
  if (motiveAllocations.length > 0) {
    let totalPct = 0;
    for (const a of motiveAllocations) {
      if (a.percentage > 0) {
        await client.billMotive.create({
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
      await client.billMotive.create({
        data: {
          billId,
          motiveId: uncatMotive.id,
          percentage: 100 - totalPct,
        },
      });
    }
  } else if (uncatMotive) {
    // No allocations, 100% to default
    await client.billMotive.create({
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
        await client.billCategory.create({
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
      await client.billCategory.create({
        data: {
          billId,
          categoryId: uncatCategory.id,
          percentage: 100 - totalPct,
        },
      });
    }
  } else if (uncatCategory) {
    // No allocations, 100% to uncategorized
    await client.billCategory.create({
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
      images: bill.images.map((img) => ({
        id: img.id,
        filename: img.filename,
        file: img.filePath,
        sortOrder: img.sortOrder,
      })),
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
    const sessionClaimsAdmin =
      session.user.role === 'admin' ||
      session.user.role === 'owner' ||
      session.user.role === 'superadmin';

    if (!isOwner && !sessionClaimsAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // SEC-02: non-owners are relying on admin authority to edit this bill —
    // re-verify against the DB rather than trusting the (possibly stale) JWT
    // claim. Superadmins are always authorized (see verifyAdminRole).
    if (!isOwner) {
      const guard = await verifyAdminRole(session.user.email, projectId);
      if (!guard.authorized) {
        return guard.response!;
      }
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

    // Paid/approved bill amount-edit rules.
    const bruttoFieldsChanged = ['brutto19', 'brutto7', 'brutto0'].some((f) =>
      Object.prototype.hasOwnProperty.call(changes, f)
    );

    if (bill.status === 'paid' && bruttoFieldsChanged) {
      return NextResponse.json(
        { error: 'Cannot change amounts of a paid bill' },
        { status: 400 }
      );
    }

    if (bill.status === 'approved' && bruttoFieldsChanged) {
      // Amount changed on an already-approved bill — allow it (caller already
      // passed the owner/admin permission check above), but reset status to
      // 'pending' so the bill requires re-approval. Recorded in the EditLog
      // below via `changes.status`.
      changes.status = 'pending';
      updates.status = 'pending';
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

    // Save allocations if provided.
    // Wrap the delete+recreate rewrite in a transaction so a partial
    // failure mid-way can't leave the bill with no allocations at all.
    if (data.motiveAllocations !== undefined || data.categoryAllocations !== undefined) {
      await prisma.$transaction(async (tx) => {
        await saveAllocations(
          id,
          data.motiveAllocations || [],
          data.categoryAllocations || [],
          projectId,
          tx as typeof prisma
        );
      });

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
    // Cross-project allocation injection: saveAllocations throws with this prefix
    if (error instanceof Error && error.message.startsWith('Invalid motive/category for this project')) {
      return NextResponse.json({ error: 'Invalid motive/category for this project' }, { status: 400 });
    }
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
    const sessionClaimsAdmin =
      session.user.role === 'admin' || session.user.role === 'owner' || session.user.role === 'superadmin';

    if (!isOwner && !sessionClaimsAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // SEC-02: non-owners are relying on admin authority — re-verify against
    // the DB rather than trusting the (possibly stale) JWT claim.
    let isVerifiedAdmin = false;
    if (!isOwner) {
      const guard = await verifyAdminRole(session.user.email, projectId);
      if (!guard.authorized) {
        return guard.response!;
      }
      isVerifiedAdmin = true;
    }

    // Bills that have reached 'approved' or 'paid' status may only be
    // deleted by a DB-verified admin, even by the bill's own submitter.
    if (bill.status === 'approved' || bill.status === 'paid') {
      if (!isVerifiedAdmin) {
        const guard = await verifyAdminRole(session.user.email, projectId);
        if (!guard.authorized) {
          return NextResponse.json(
            { error: `Only an admin can delete a bill with status '${bill.status}'` },
            { status: 403 }
          );
        }
        isVerifiedAdmin = true;
      }
    }

    // Record the deletion in the audit trail and remove the bill
    // inside a single transaction BEFORE touching the filesystem.
    // EditLog.billId is onDelete: SetNull, so this audit row survives the
    // bill delete.
    const imagePaths = bill.images.filter((img) => img.filePath).map((img) => img.filePath);

    await prisma.$transaction([
      prisma.editLog.create({
        data: {
          projectId,
          timestamp: new Date(),
          user: session.user.email,
          billId: id,
          changes: {
            _event: 'deleted',
            billNumber: bill.billNumber,
            vendor: bill.vendor,
            item: bill.item,
            amount: Number(bill.grossAmount),
          } as never,
          source: 'user',
        },
      }),
      prisma.bill.delete({
        where: { id },
      }),
    ]);

    // Clean up image files only after the DB transaction has committed —
    // tolerate per-file unlink errors without failing the request.
    for (const filePath of imagePaths) {
      const imgPath = path.join(UPLOADS_DIR, filePath);
      try {
        if (fs.existsSync(imgPath)) {
          fs.unlinkSync(imgPath);
        }
      } catch (e) {
        console.error('Failed to delete image file:', e);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error deleting bill:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
