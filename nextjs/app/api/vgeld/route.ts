// ============================================================================
// V-Geld API - GET / POST
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';
import { z } from 'zod';

// Validation schema for creating a V-Geld transfer
const createVgeldSchema = z.object({
  amount: z.number().positive('Amount must be a positive number'),
  to: z.string().min(1, 'Recipient is required'),
  from: z.string().optional(),
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

    const transfers = await prisma.vgeld.findMany({
      where: { projectId },
      orderBy: { date: 'desc' },
    });

    const mapped = transfers.map((t) => ({
      id: t.id,
      date: t.date.toISOString(),
      amount: Number(t.amount),
      from: t.fromUser ?? 'External',
      to: t.toUser,
      createdBy: t.createdBy,
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

    // Verify project membership and admin role
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userEmail: {
          projectId,
          userEmail: session.user.email,
        },
      },
    });

    const isSuperAdmin = session.user.role === 'superadmin';
    const isAdmin = membership?.role === 'admin' || membership?.role === 'owner';

    if (!isSuperAdmin && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 });
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

    return NextResponse.json({ ok: true, id: transfer.id });
  } catch (error) {
    console.error('Error creating V-Geld transfer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
