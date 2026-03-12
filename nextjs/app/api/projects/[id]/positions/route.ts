import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(1).max(50),
});

// GET /api/projects/[id]/positions - List project positions
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
      return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 });
    }

    const positions = await prisma.projectPosition.findMany({
      where: { projectId: id },
      include: {
        members: true,
      },
    });

    return NextResponse.json(
      positions.map((p) => ({
        id: p.id,
        name: p.name,
        memberCount: p.members.length,
      }))
    );
  } catch (error) {
    console.error('Error fetching positions:', error);
    return NextResponse.json({ error: 'Failed to fetch positions' }, { status: 500 });
  }
}

// POST /api/projects/[id]/positions - Create position
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
    // Check if user is admin or owner
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userEmail: {
          projectId: id,
          userEmail: session.user.email,
        },
      },
    });

    if (!membership || (membership.role !== 'admin' && membership.role !== 'owner')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validated = createSchema.parse(body);

    // Check for "Misc" reservation
    if (validated.name.toLowerCase() === 'misc') {
      return NextResponse.json(
        { error: "'Misc' is reserved" },
        { status: 400 }
      );
    }

    // Check for duplicate
    const existing = await prisma.projectPosition.findFirst({
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
        { error: 'Position already exists' },
        { status: 400 }
      );
    }

    const position = await prisma.projectPosition.create({
      data: {
        projectId: id,
        name: validated.name,
      },
    });

    return NextResponse.json({ ...position, memberCount: 0 }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error('Error creating position:', error);
    return NextResponse.json({ error: 'Failed to create position' }, { status: 500 });
  }
}
