import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const switchSchema = z.object({
  projectId: z.string(),
});

// POST /api/projects/switch - Switch current project
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { projectId } = switchSchema.parse(body);

    // Verify user is a member of this project
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userEmail: {
          projectId,
          userEmail: session.user.email,
        },
      },
      include: {
        project: true,
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 });
    }

    // Update user's default project
    await prisma.user.update({
      where: { email: session.user.email },
      data: { defaultProjectId: projectId },
    });

    return NextResponse.json({
      currentProjectId: projectId,
      currentProjectRole: membership.role,
      currentProjectName: membership.project.name,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error('Error switching project:', error);
    return NextResponse.json({ error: 'Failed to switch project' }, { status: 500 });
  }
}
