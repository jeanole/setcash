// ============================================================================
// Bills API - GET / POST
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import { parseForm, getUploadedFiles, ensureUploadDir, generateFilename, UPLOADS_DIR } from '@/lib/upload';
import { billCreateLimiter } from '@/lib/ratelimit';

// Validation schemas
const createBillSchema = z.object({
  date: z.string().datetime().optional(),
  type: z.string().default('Kauf'),
  vendor: z.string().optional(),
  item: z.string().optional(),
  comment: z.string().optional(),
  brutto19: z.number().min(0).default(0),
  brutto7: z.number().min(0).default(0),
  brutto0: z.number().min(0).default(0),
  motiveAllocations: z.array(z.object({
    motiveId: z.string(),
    percentage: z.number().min(0).max(100),
  })).default([]),
  categoryAllocations: z.array(z.object({
    categoryId: z.string(),
    percentage: z.number().min(0).max(100),
  })).default([]),
});

// Calculate bill number for a user within a project (1.01-1.20, 2.01-2.20, etc.)
async function calculateBillNumber(userEmail: string, projectId: string): Promise<string> {
  const count = await prisma.bill.count({
    where: {
      submittedByEmail: { equals: userEmail, mode: 'insensitive' },
      projectId,
    },
  });
  
  const group = Math.floor(count / 20) + 1;
  const position = (count % 20) + 1;
  return `${group}.${position.toString().padStart(2, '0')}`;
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

    // Get all bills with related data
    const bills = await prisma.bill.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
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
    });

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

    return NextResponse.json(mapped);
  } catch (error) {
    console.error('Error fetching bills:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/bills - Create new bill with images
export async function POST(req: NextRequest) {
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

    // Parse multipart form
    const { fields, files } = await parseForm(req);

    // Extract and validate form data
    const date = fields.date?.[0] || new Date().toISOString();
    const type = fields.type?.[0] || 'Kauf';
    const vendor = fields.vendor?.[0] || '';
    const item = fields.item?.[0] || '';
    const comment = fields.comment?.[0] || '';
    const brutto19 = parseFloat(fields.brutto19?.[0] || '0') || 0;
    const brutto7 = parseFloat(fields.brutto7?.[0] || '0') || 0;
    const brutto0 = parseFloat(fields.brutto0?.[0] || '0') || 0;

    // Parse allocations
    let motiveAllocations: { motiveId: string; percentage: number }[] = [];
    let categoryAllocations: { categoryId: string; percentage: number }[] = [];

    try {
      if (fields.motiveAllocations?.[0]) {
        motiveAllocations = JSON.parse(fields.motiveAllocations[0]);
      }
    } catch (e) {
      console.warn('Failed to parse motiveAllocations:', e);
    }

    try {
      if (fields.categoryAllocations?.[0]) {
        categoryAllocations = JSON.parse(fields.categoryAllocations[0]);
      }
    } catch (e) {
      console.warn('Failed to parse categoryAllocations:', e);
    }

    // Calculate bill number
    const billNumber = await calculateBillNumber(session.user.email, projectId);

    // Determine status based on vendor and amount
    const totalAmount = brutto19 + brutto7 + brutto0;
    const status: 'draft' | 'confirmed' = !vendor || vendor.trim() === '' || totalAmount === 0 ? 'draft' : 'confirmed';

    // Calculate netto
    const nettoAmount = brutto19 / 1.19 + brutto7 / 1.07 + brutto0;

    // Build motive display string
    let motiveDisplay = '';
    if (motiveAllocations.length > 0) {
      const motives = await prisma.motive.findMany({
        where: { id: { in: motiveAllocations.map((a) => a.motiveId) } },
      });
      motiveDisplay = motives.map((m) => m.name).filter(Boolean).join(', ');
    }

    // Create bill
    const bill = await prisma.bill.create({
      data: {
        date: new Date(date),
        submittedByEmail: session.user.email,
        billNumber,
        type,
        vendor,
        item,
        comment,
        motiveLegacy: motiveDisplay,
        brutto19,
        brutto7,
        brutto0,
        grossAmount: totalAmount,
        nettoAmount,
        projectId,
        status,
      },
    });

    // Handle file uploads
    const uploadedFiles = getUploadedFiles(files, 'photos');
    
    if (uploadedFiles.length > 0) {
      const userFolder = ensureUploadDir(session.user.email);
      const dateStr = new Date().toISOString().split('T')[0];

      for (let i = 0; i < uploadedFiles.length; i++) {
        const f = uploadedFiles[i];
        const ext = path.extname(f.originalFilename || '') || '.jpg';
        const suffix = uploadedFiles.length > 1 ? `_${i + 1}` : '';
        const savedFilename = generateFilename(userFolder, billNumber, dateStr, suffix, f.originalFilename || '');
        const relPath = `${userFolder}/${savedFilename}`;
        const savedFilePath = path.join(UPLOADS_DIR, relPath);

        // Move file to final location
        fs.renameSync(f.filepath, savedFilePath);

        // Create image record
        await prisma.billImage.create({
          data: {
            billId: bill.id,
            filename: f.originalFilename || '',
            filePath: relPath,
            sortOrder: i,
          },
        });
      }

      // Sync legacy columns with first image
      await syncLegacyImageColumns(bill.id);
    }

    // Save allocations
    await saveAllocations(bill.id, motiveAllocations, categoryAllocations, projectId);

    // Update motive display after allocations are saved
    const updatedMotiveDisplay = await getMotiveDisplayString(bill.id);
    if (updatedMotiveDisplay !== motiveDisplay) {
      await prisma.bill.update({
        where: { id: bill.id },
        data: { motiveLegacy: updatedMotiveDisplay },
      });
    }

    // Log creation
    await prisma.editLog.create({
      data: {
        projectId,
        timestamp: new Date(),
        user: session.user.email,
        billId: bill.id,
        changes: { _event: 'created' },
        source: 'user',
      },
    });

    return NextResponse.json({ ok: true, id: bill.id });
  } catch (error) {
    console.error('Error creating bill:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
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
