// ============================================================================
// Bills API - GET / POST
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import type { File } from 'formidable';
import {
  parseForm,
  getUploadedFiles,
  ensureUploadDir,
  generateFilename,
  validateFile,
  uploadErrorResponse,
  UPLOADS_DIR,
} from '@/lib/upload';
import { billCreateLimiter } from '@/lib/ratelimit';
import { calculateNetto } from '@/lib/utils';
import {
  InvalidAllocationError,
  PLAIN_AMOUNT_PATTERN,
  billTextSchemas,
  bruttoAmountSchema,
  categoryAllocationsSchema,
  motiveAllocationsSchema,
  nextBillNumber,
  runSerializable,
  saveAllocations,
} from '@/app/api/bills/_lib/shared';

// Thrown inside the create transaction when the project's bill quota is used up
class UploadLimitError extends Error {
  constructor() {
    super('Upload limit reached for this project. Contact your administrator.');
    this.name = 'UploadLimitError';
  }
}

// Amounts arrive as multipart text fields: blank/missing means 0, anything that
// is not a plain decimal number (digits, optional . and 1-2 fraction digits) is
// rejected rather than silently coerced -- Number() would accept hex, exponents etc.
const amountField = z
  .string()
  .trim()
  .default('')
  .transform((v, ctx) => {
    if (v === '') return 0;
    if (!PLAIN_AMOUNT_PATTERN.test(v)) {
      ctx.addIssue({ code: 'custom', message: 'Must be a plain decimal number with at most 2 decimals' });
      return z.NEVER;
    }
    return Number(v);
  })
  .pipe(bruttoAmountSchema);

const dateField = z
  .string()
  .trim()
  .refine((v) => {
    const t = Date.parse(v);
    if (isNaN(t)) return false;
    const year = new Date(t).getUTCFullYear();
    return year >= 1970 && year <= 2100;
  }, 'Invalid date');

// Parses a JSON-encoded array field; invalid JSON becomes a validation error
function jsonArrayField<T extends z.ZodTypeAny>(schema: T) {
  return z
    .string()
    .default('')
    .transform((v, ctx) => {
      if (v.trim() === '') return [];
      try {
        return JSON.parse(v) as unknown;
      } catch {
        ctx.addIssue({ code: 'custom', message: 'Must be valid JSON' });
        return z.NEVER;
      }
    })
    .pipe(schema);
}

// Validation schema for the multipart text fields of POST /api/bills
const createBillSchema = z.object({
  date: dateField,
  type: billTextSchemas.type.default('Kauf'),
  vendor: billTextSchemas.vendor.default(''),
  item: billTextSchemas.item.default(''),
  comment: billTextSchemas.comment.default(''),
  brutto19: amountField,
  brutto7: amountField,
  brutto0: amountField,
  motiveAllocations: jsonArrayField(motiveAllocationsSchema),
  categoryAllocations: jsonArrayField(categoryAllocationsSchema),
});

// Pagination query schema for GET /api/bills
const getBillsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1)),
  pageSize: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 50))
    .pipe(z.number().int().min(1).max(200)),
});

// GET /api/bills - List all bills for current project
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

    // Parse and validate pagination params
    const { searchParams } = new URL(req.url);
    const queryParsed = getBillsQuerySchema.safeParse({
      page: searchParams.get('page') ?? undefined,
      pageSize: searchParams.get('pageSize') ?? undefined,
    });
    if (!queryParsed.success) {
      return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
    }
    const { page, pageSize } = queryParsed.data;

    const where = { projectId };

    // Run count and data fetch in parallel
    const [total, bills] = await Promise.all([
      prisma.bill.count({ where }),
      prisma.bill.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        take: pageSize,
        skip: (page - 1) * pageSize,
        include: {
          images: {
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
            select: {
              id: true,
              filename: true,
              filePath: true,
              sortOrder: true,
            },
          },
          motives: {
            include: {
              motive: {
                select: { name: true },
              },
            },
          },
          categories: {
            include: {
              category: {
                select: { name: true },
              },
            },
          },
        },
      }),
    ]);

    // Get user roles for this project
    const userRoles = await prisma.projectMember.findMany({
      where: { projectId },
      include: {
        position: { select: { name: true } },
      },
    });

    const roleMap = new Map(userRoles.map((u) => [u.userEmail.toLowerCase(), u.position?.name || 'Misc']));

    // Map response
    const mapped = bills.map((b) => ({
      id: b.id,
      date: b.date.toISOString(),
      email: b.submittedByEmail,
      role: roleMap.get(b.submittedByEmail.toLowerCase()) || 'Misc',
      billNumber: b.billNumber,
      type: b.type,
      vendor: b.vendor,
      item: b.item,
      comment: b.comment,
      motive: b.motiveLegacy,
      brutto19: Number(b.brutto19),
      brutto7: Number(b.brutto7),
      brutto0: Number(b.brutto0),
      amount: Number(b.grossAmount),
      netto19: Number(b.brutto19) / 1.19,
      netto7: Number(b.brutto7) / 1.07,
      netto0: Number(b.brutto0),
      nettoAmount: Number(b.nettoAmount),
      filename: b.filename,
      images: b.images.map((img) => ({
        id: img.id,
        filename: img.filename,
        file: img.filePath,
        sortOrder: img.sortOrder,
      })),
      motiveAllocations: b.motives.map((m) => ({
        id: m.id,
        motiveId: m.motiveId,
        name: m.motive.name,
        percentage: Number(m.percentage),
      })),
      categoryAllocations: b.categories.map((c) => ({
        id: c.id,
        categoryId: c.categoryId,
        name: c.category.name,
        percentage: Number(c.percentage),
      })),
      status: b.status,
      ocrStatus: b.ocrStatus,
      ocrFields: b.ocrFields as string[] | null,
    }));

    return NextResponse.json({ bills: mapped, total, page, pageSize });
  } catch (error) {
    console.error('Error fetching bills:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/bills - Create new bill with images
export async function POST(req: NextRequest) {
  // Temp files written by parseForm and files moved to their final location are
  // tracked here so every early return / throw below can clean them up.
  let uploadedFiles: File[] = [];
  const movedFilePaths: string[] = [];

  const cleanupFiles = () => {
    for (const f of uploadedFiles) {
      if (f.filepath && fs.existsSync(f.filepath)) {
        try { fs.unlinkSync(f.filepath); } catch { /* best-effort cleanup */ }
      }
    }
    for (const filePath of movedFilePaths) {
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (unlinkError) {
        console.error('File cleanup failed:', filePath, unlinkError);
      }
    }
  };

  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting: 10 requests per minute per user
    const identifier = session.user.id || session.user.email;
    const { success } = await billCreateLimiter.limit(identifier);
    if (!success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const projectId = session.user.currentProjectId;
    if (!projectId) {
      return NextResponse.json({ error: 'No project selected' }, { status: 400 });
    }

    // Block bill uploads on example projects
    if (session.user.isExampleProject) {
      return NextResponse.json(
        { error: 'Uploading bills is not available in the Example Project. Join or create a real project to upload bills.' },
        { status: 403 }
      );
    }

    // Block demo accounts from uploading bills
    if (session.user.isDemoAccount && session.user.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Demo accounts cannot upload bills. Create a real account to start tracking expenses.' },
        { status: 403 }
      );
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

    // Early quota check so an over-limit project doesn't pay for parsing an
    // upload. The authoritative check runs inside the create transaction below.
    const projectForQuota = await prisma.project.findUnique({
      where: { id: projectId },
      select: { uploadLimit: true },
    });
    if (projectForQuota?.uploadLimit != null) {
      const billCount = await prisma.bill.count({ where: { projectId } });
      if (billCount >= projectForQuota.uploadLimit) {
        return NextResponse.json(
          { error: 'Upload limit reached for this project. Contact your administrator.' },
          { status: 403 }
        );
      }
    }

    // Parse multipart form (size-capped; throws UploadError for bad/oversized bodies)
    const { fields, files } = await parseForm(req, { fields: ['photos'] });

    // Get uploaded files and validate their content up front — this
    // runs before the bill row is created so we never create an orphaned bill
    // for a rejected upload.
    uploadedFiles = getUploadedFiles(files, 'photos');

    for (const f of uploadedFiles) {
      const result = validateFile(f);
      if (!result.valid) {
        cleanupFiles();
        return NextResponse.json({ error: result.error || 'Invalid file' }, { status: 400 });
      }
    }

    // Validate all text fields (amounts, date, lengths, allocations)
    const field = (name: string) => fields[name]?.[0];
    const parsed = createBillSchema.safeParse({
      date: field('date') || new Date().toISOString(),
      type: field('type'),
      vendor: field('vendor'),
      item: field('item'),
      comment: field('comment'),
      brutto19: field('brutto19'),
      brutto7: field('brutto7'),
      brutto0: field('brutto0'),
      motiveAllocations: field('motiveAllocations'),
      categoryAllocations: field('categoryAllocations'),
    });
    if (!parsed.success) {
      cleanupFiles();
      const issue = parsed.error.issues[0];
      const where = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
      return NextResponse.json({ error: `Invalid input - ${where}${issue.message}` }, { status: 400 });
    }

    const {
      date, type, vendor, item, comment,
      brutto19, brutto7, brutto0,
      motiveAllocations, categoryAllocations,
    } = parsed.data;

    // Determine status based on vendor and amount
    const totalAmount = brutto19 + brutto7 + brutto0;
    const status: 'draft' | 'confirmed' = !vendor || vendor.trim() === '' || totalAmount === 0 ? 'draft' : 'confirmed';

    // Calculate netto
    const nettoAmount = calculateNetto(brutto19, brutto7, brutto0);

    // Move uploads to their final, collision-free location BEFORE the DB write;
    // the bill + images + allocations are then committed atomically. If the
    // transaction fails, cleanupFiles() in the catch below removes them again.
    const imageRows: { filename: string; filePath: string; sortOrder: number }[] = [];
    if (uploadedFiles.length > 0) {
      const userFolder = ensureUploadDir(session.user.email);
      const dateStr = new Date().toISOString().split('T')[0];

      for (let i = 0; i < uploadedFiles.length; i++) {
        const f = uploadedFiles[i];
        const savedFilename = generateFilename(userFolder, 'bill', dateStr, `_${i}`, f.originalFilename || '');
        const relPath = `${userFolder}/${savedFilename}`;
        const savedFilePath = path.join(UPLOADS_DIR, relPath);

        fs.renameSync(f.filepath, savedFilePath);
        movedFilePaths.push(savedFilePath);

        imageRows.push({
          filename: f.originalFilename || '',
          filePath: relPath,
          sortOrder: i,
        });
      }
    }

    // Create bill, images, allocations and audit log in one serializable
    // transaction. Bill number and quota are evaluated inside it so concurrent
    // requests can neither duplicate a number nor overshoot the upload limit.
    const bill = await runSerializable(async (tx) => {
      if (projectForQuota?.uploadLimit != null) {
        const billCount = await tx.bill.count({ where: { projectId } });
        if (billCount >= projectForQuota.uploadLimit) {
          throw new UploadLimitError();
        }
      }

      const billNumber = await nextBillNumber(tx, session.user.email, projectId);
      const created = await tx.bill.create({
        data: {
          date: new Date(date),
          submittedByEmail: session.user.email,
          billNumber,
          type,
          vendor,
          item,
          comment,
          motiveLegacy: '',
          brutto19,
          brutto7,
          brutto0,
          grossAmount: totalAmount,
          nettoAmount,
          projectId,
          status,
          filename: imageRows[0]?.filePath ?? '',
          images: imageRows.length > 0 ? { create: imageRows } : undefined,
        },
      });

      // Throws InvalidAllocationError if IDs are cross-project
      const motiveDisplay = await saveAllocations(
        tx,
        created.id,
        motiveAllocations,
        categoryAllocations,
        projectId
      );
      if (motiveDisplay !== '') {
        await tx.bill.update({ where: { id: created.id }, data: { motiveLegacy: motiveDisplay } });
      }

      await tx.editLog.create({
        data: {
          projectId,
          timestamp: new Date(),
          user: session.user.email,
          billId: created.id,
          changes: { _event: 'created' },
          source: 'user',
        },
      });

      return created;
    });

    return NextResponse.json({ ok: true, id: bill.id });
  } catch (error) {
    cleanupFiles();

    const uploadResponse = uploadErrorResponse(error);
    if (uploadResponse) return uploadResponse;

    // Cross-project allocation injection
    if (error instanceof InvalidAllocationError) {
      return NextResponse.json({ error: 'Invalid motive/category for this project' }, { status: 400 });
    }
    if (error instanceof UploadLimitError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Error creating bill:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
