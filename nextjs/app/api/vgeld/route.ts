// ============================================================================
// V-Geld API - GET / POST
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';
import { z } from 'zod';
import { notifyProjectAdmins } from '@/lib/notifications';

// Validation schema for GET query params
const listVgeldSchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

// Validation schema for creating a V-Geld transfer
const createVgeldSchema = z.object({
  amount: z.number().positive('Amount must be a positive number').multipleOf(0.01, 'Amount must have at most 2 decimal places'),
  to: z.string().min(1, 'Recipient is required'),
  from: z.string().max(100, 'From must be 100 characters or fewer').optional(),
});

// GET /api/vgeld - List all V-Geld transfers for current project
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

    // Verify project membership
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

    const queryParsed = listVgeldSchema.safeParse({
      limit: req.nextUrl.searchParams.get('limit') ?? undefined,
    });
    const limit = queryParsed.success ? queryParsed.data.limit : 200;

    const transfers = await prisma.vgeld.findMany({
      where: { projectId },
      orderBy: { date: 'desc' },
      take: limit,
    });

    const mapped = transfers.map((t) => ({
      id: t.id,
      date: t.date.toISOString(),
      amount: Number(t.amount),
      from: t.fromUser ?? 'External',
      to: t.toUser,
      createdBy: t.createdBy,
      confirmedBy: t.confirmedBy ?? null,
    }));

    return NextResponse.json(mapped);
  } catch (error) {
    console.error('Error fetching V-Geld transfers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/vgeld - Create new V-Geld transfer
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = session.user.currentProjectId;
    if (!projectId) {
      return NextResponse.json({ error: 'No project selected' }, { status: 400 });
    }

    // Verify project membership (any member may create a transfer)
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

    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = createVgeldSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { amount, to, from = 'External' } = parsed.data;

    // Verify recipient is a project member
    const recipientMembership = await prisma.projectMember.findUnique({
      where: {
        projectId_userEmail: {
          projectId,
          userEmail: to,
        },
      },
    });

    if (!recipientMembership) {
      return NextResponse.json(
        { error: 'Recipient is not a member of this project' },
        { status: 400 }
      );
    }

    const transfer = await prisma.vgeld.create({
      data: {
        projectId,
        date: new Date(),
        amount,
        fromUser: from,
        toUser: to,
        createdBy: session.user.email,
      },
    });

    // Fire-and-forget: notify project admins about the new transfer request
    void Promise.resolve().then(async () => {
      try {
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          select: { name: true },
        });
        const projectName = project?.name ?? projectId;
        const amountStr = Number(transfer.amount).toFixed(2);
        await notifyProjectAdmins(
          projectId,
          'transfer_requested',
          `A transfer of ${amountStr} was requested in '${projectName}'.`
        );
      } catch {
        // ignore
      }
    });

    return NextResponse.json({ ok: true, id: transfer.id });
  } catch (error) {
    console.error('Error creating V-Geld transfer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
