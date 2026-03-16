import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  subtitle: z.string().max(200).optional().nullable(),
});

// GET /api/projects - List user's projects
export async function GET() {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const memberships = await prisma.projectMember.findMany({
      where: { userEmail: session.user.email },
      include: {
        project: {
          include: {
            members: true,
          },
        },
      },
    });

    const projects = memberships.map((membership) => ({
      id: membership.projectId,
      name: membership.project.name,
      subtitle: membership.project.subtitle,
      role: membership.role,
      memberCount: membership.project.members.length,
      isCurrent: membership.projectId === session.user.currentProjectId,
    }));

    return NextResponse.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

// POST /api/projects - Create new project
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Block demo accounts from creating projects
  if (session.user.isDemoAccount && session.user.role !== 'superadmin') {
    return NextResponse.json({ error: 'Demo accounts cannot create projects.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const validated = createProjectSchema.parse(body);

    const project = await prisma.$transaction(async (tx) => {
      // Create project
      const newProject = await tx.project.create({
        data: {
          name: validated.name,
          subtitle: validated.subtitle,
        },
      });

      // Add creator as owner
      await tx.projectMember.create({
        data: {
          projectId: newProject.id,
          userEmail: session.user!.email!,
          role: 'owner',
        },
      });

      // Create default positions
      await tx.projectPosition.createMany({
        data: [
          { projectId: newProject.id, name: 'Misc' },
          { projectId: newProject.id, name: 'Szenenbild' },
          { projectId: newProject.id, name: 'Props' },
          { projectId: newProject.id, name: 'Set Dec' },
          { projectId: newProject.id, name: 'Fahrer' },
          { projectId: newProject.id, name: 'Baubühne' },
        ],
      });

      // Create default motive and category
      await tx.motive.create({
        data: {
          projectId: newProject.id,
          name: 'Default',
          budget: 0,
        },
      });

      await tx.category.create({
        data: {
          projectId: newProject.id,
          name: 'Uncategorized',
          budget: 0,
        },
      });

      // Apply defaultUploadLimit from SystemConfig if set
      const defaultLimitConfig = await tx.systemConfig.findUnique({
        where: { key: 'defaultUploadLimit' },
      });
      if (defaultLimitConfig?.value != null) {
        const defaultLimit = parseInt(defaultLimitConfig.value, 10);
        if (Number.isFinite(defaultLimit) && defaultLimit > 0) {
          await tx.project.update({
            where: { id: newProject.id },
            data: { uploadLimit: defaultLimit },
          });
          newProject.uploadLimit = defaultLimit;
        }
      }

      return newProject;
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error('Error creating project:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
