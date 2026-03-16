// ============================================================================
// Project Quota API - GET
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';

// GET /api/projects/[id]/quota - Get upload quota info for a project
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Must be a member of the project OR superadmin
    if (session.user.role !== 'superadmin') {
      const membership = await prisma.projectMember.findUnique({
        where: {
          projectId_userEmail: {
            projectId: id,
            userEmail: session.user.email,
          },
        },
      });
      if (!membership) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const project = await prisma.project.findUnique({
      where: { id },
      select: { uploadLimit: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const billCount = await prisma.bill.count({ where: { projectId: id } });

    return NextResponse.json({
      uploadLimit: project.uploadLimit,
      billCount,
    });
  } catch (error) {
    console.error('Error fetching project quota:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
