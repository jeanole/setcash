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
import {
  InvalidAllocationError,
  billTextSchemas,
  bruttoAmountSchema,
  categoryAllocationsSchema,
  isDbVerifiedAdmin,
  motiveAllocationsSchema,
  readAllocationSnapshot,
  saveAllocations,
} from '@/app/api/bills/_lib/shared';

// Validation schemas -- the field limits are shared with POST /api/bills
const updateBillSchema = z.object({
  date: z.string().datetime().optional(),
  type: billTextSchemas.type.optional(),
  vendor: billTextSchemas.vendor.optional(),
  item: billTextSchemas.item.optional(),
  comment: billTextSchemas.comment.optional(),
  brutto19: bruttoAmountSchema.optional(),
  brutto7: bruttoAmountSchema.optional(),
  brutto0: bruttoAmountSchema.optional(),
  motiveAllocations: motiveAllocationsSchema.optional(),
  categoryAllocations: categoryAllocationsSchema.optional(),
});

// Thrown inside the update transaction when the bill's status changed between
// the permission check and the write (another request got there first).
class BillConflictError extends Error {
  constructor() {
    super('Bill was modified by another request');
    this.name = 'BillConflictError';
  }
}

// Thrown inside the update transaction when a non-admin tries to change the
// allocations of a paid bill (rolls back everything written so far).
class PaidBillLockedError extends Error {
  constructor() {
    super('Only an admin can modify a paid bill');
    this.name = 'PaidBillLockedError';
  }
}

// GET /api/bills/[id] - Get single bill
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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
export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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
    // The edit form only knows the calendar day (YYYY-MM-DD, shown as the UTC
    // day of the stored timestamp) and always sends it back as midnight UTC.
    // A date on the same UTC day as the stored one is therefore UNCHANGED: keep
    // the stored timestamp (e.g. a Telegram bill's time of day) and do not count
    // it as an edit (no status reset, no EditLog entry). Only a real day change
    // counts.
    if (data.date !== undefined) {
      const newDate = new Date(data.date);
      const sameDay = newDate.toISOString().slice(0, 10) === bill.date.toISOString().slice(0, 10);
      if (!sameDay) {
        changes.date = data.date;
        updates.date = newDate;
      }
    }
    // Stored NULL text fields equal the empty string the edit form sends for
    // them (Telegram bills may have no vendor/item/comment yet).
    if (data.type !== undefined && data.type !== bill.type) {
      changes.type = data.type;
      updates.type = data.type;
    }
    if (data.vendor !== undefined && data.vendor !== (bill.vendor ?? '')) {
      changes.vendor = data.vendor;
      updates.vendor = data.vendor;
    }
    if (data.item !== undefined && data.item !== (bill.item ?? '')) {
      changes.item = data.item;
      updates.item = data.item;
    }
    if (data.comment !== undefined && data.comment !== (bill.comment ?? '')) {
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

    // Approved/paid bills are financially locked. Anyone who is not a
    // DB-verified admin (typically the submitter) is restricted for EVERY
    // editable field, not just the amounts: re-allocating or changing the date,
    // vendor, item, type or comment moves spending just as much.
    const isLockedStatus = bill.status === 'approved' || bill.status === 'paid';
    const isRestricted = isLockedStatus && !(await isDbVerifiedAdmin(session.user.email, projectId));
    const otherFieldsChanged = ['date', 'type', 'vendor', 'item', 'comment'].some((f) =>
      Object.prototype.hasOwnProperty.call(changes, f)
    );

    if (bill.status === 'paid' && bruttoFieldsChanged) {
      return NextResponse.json(
        { error: 'Cannot change amounts of a paid bill' },
        { status: 400 }
      );
    }

    if (bill.status === 'paid' && isRestricted && otherFieldsChanged) {
      return NextResponse.json(
        { error: 'Only an admin can modify a paid bill' },
        { status: 403 }
      );
    }

    if (bill.status === 'approved' && (bruttoFieldsChanged || (isRestricted && otherFieldsChanged))) {
      // Amount (or, for a non-admin, any other field) changed on an
      // already-approved bill — allow it (caller already passed the owner/admin
      // permission check above), but reset status to 'pending' so the bill
      // requires re-approval. Recorded in the EditLog below via `changes.status`.
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

    // Apply everything in one transaction. The bill row is updated first with
    // `status: bill.status` in the WHERE clause (compare-and-swap): if another
    // request changed the status after we read it (e.g. the bill was just paid),
    // nothing is written and we answer 409 instead of editing a locked bill.
    const allocationsProvided =
      data.motiveAllocations !== undefined || data.categoryAllocations !== undefined;

    await prisma.$transaction(async (tx) => {
      const claimed = await tx.bill.updateMany({
        where: { id, projectId, status: bill.status },
        // With no field changes, re-write the unchanged status so the row is still locked + checked
        data: Object.keys(updates).length > 0 ? updates : { status: bill.status },
      });
      if (claimed.count === 0) {
        throw new BillConflictError();
      }

      // Replace allocations (delete + recreate); also refreshes the legacy motive column
      if (allocationsProvided) {
        const before = isRestricted ? await readAllocationSnapshot(tx, id) : '';
        const motiveStr = await saveAllocations(
          tx,
          id,
          data.motiveAllocations || [],
          data.categoryAllocations || [],
          projectId
        );

        // A restricted caller who actually changed the allocations of a locked bill
        if (isRestricted && before !== (await readAllocationSnapshot(tx, id))) {
          if (bill.status === 'paid') throw new PaidBillLockedError();
          if (updates.status !== 'pending') {
            await tx.bill.update({ where: { id }, data: { status: 'pending' } });
            changes.status = 'pending';
          }
        }

        if (motiveStr !== bill.motiveLegacy) {
          changes.motive = motiveStr;
          await tx.bill.update({ where: { id }, data: { motiveLegacy: motiveStr } });
        }
      }

      // Log the edit if there are field changes or allocation changes
      if (Object.keys(changes).length > 0 || allocationsProvided) {
        await tx.editLog.create({
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
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    // Cross-project allocation injection
    if (error instanceof InvalidAllocationError) {
      return NextResponse.json({ error: 'Invalid motive/category for this project' }, { status: 400 });
    }
    if (error instanceof PaidBillLockedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof BillConflictError) {
      return NextResponse.json(
        { error: 'Bill was modified by another request. Reload and try again.' },
        { status: 409 }
      );
    }
    console.error('Error updating bill:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/bills/[id] - Delete bill
export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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
      // Side-effect-free check: verifyAdminRole would clear a plain
      // submitter's session cookie, which is the wrong outcome here.
      if (!isVerifiedAdmin && !(await isDbVerifiedAdmin(session.user.email, projectId))) {
        return NextResponse.json(
          { error: `Only an admin can delete a bill with status '${bill.status}'` },
          { status: 403 }
        );
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
