import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  subtitle: z.string().max(200).optional().nullable(),
});

// GET /api/projects/[id] - Get project details
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

    const project = await prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 });
  }
}

// PUT /api/projects/[id] - Update project
export async function PUT(
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
    const validated = updateSchema.parse(body);

    const project = await prisma.project.update({
      where: { id },
      data: validated,
    });

    return NextResponse.json(project);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error('Error updating project:', error);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

// DELETE /api/projects/[id] - Delete project
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Check if user is owner
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userEmail: {
          projectId: id,
          userEmail: session.user.email,
        },
      },
      include: {
        project: {
          include: {
            members: true,
          },
        },
      },
    });

    if (!membership || membership.role !== 'owner') {
      return NextResponse.json({ error: 'Only owners can delete projects' }, { status: 403 });
    }

    // Check if project has other members
    if (membership.project.members.length > 1) {
      return NextResponse.json(
        { error: 'Remove all other members before deleting the project' },
        { status: 400 }
      );
    }

    // Delete project (cascade will handle related data)
    await prisma.project.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error deleting project:', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
