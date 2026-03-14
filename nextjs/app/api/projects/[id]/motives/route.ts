import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  budget: z.number().min(0).optional().default(0),
});

// GET /api/projects/[id]/motives - List project motives
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Check if user is a member
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userEmail: {
          projectId: id,
          userEmail: session.user.email,
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const motives = await prisma.motive.findMany({
      where: { projectId: id },
      include: {
        billMotives: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json(
      motives.map((m) => ({
        id: m.id,
        name: m.name,
        budget: Number(m.budget),
        billCount: m.billMotives.length,
      }))
    );
  } catch (error) {
    console.error('Error fetching motives:', error);
    return NextResponse.json({ error: 'Failed to fetch motives' }, { status: 500 });
  }
}

// POST /api/projects/[id]/motives - Create motive
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Check if user is admin, owner, or superadmin
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userEmail: {
          projectId: id,
          userEmail: session.user.email,
        },
      },
    });

    const isSuperAdmin = session.user.role === 'superadmin';
    const isAdminOrOwner = membership?.role === 'admin' || membership?.role === 'owner';

    if (!isSuperAdmin && !isAdminOrOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validated = createSchema.parse(body);

    // Check for "Default" reservation
    if (validated.name === 'Default') {
      return NextResponse.json(
        { error: "'Default' is a reserved motive name" },
        { status: 400 }
      );
    }

    // Check for duplicate (case-insensitive)
    const existing = await prisma.motive.findFirst({
      where: {
        projectId: id,
        name: {
          equals: validated.name,
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A motive with this name already exists' },
        { status: 400 }
      );
    }

    const motive = await prisma.motive.create({
      data: {
        projectId: id,
        name: validated.name,
        budget: validated.budget,
      },
    });

    return NextResponse.json(
      { id: motive.id, name: motive.name, budget: Number(motive.budget), billCount: 0 },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    if ((error as any)?.code === 'P2002') {
      return NextResponse.json({ error: 'A motive with this name already exists' }, { status: 409 });
    }
    console.error('Error creating motive:', error);
    return NextResponse.json({ error: 'Failed to create motive' }, { status: 500 });
  }
}
