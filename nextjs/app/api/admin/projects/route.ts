// ============================================================================
// Admin Projects API - GET (list all projects with member counts)
// ============================================================================

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';

// GET /api/admin/projects - List all projects with member counts
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is super-admin
    if (session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const projects = await prisma.project.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        subtitle: true,
        createdAt: true,
        _count: {
          select: {
            members: true,
          },
        },
      },
    });

    const mapped = projects.map((p) => ({
      id: p.id,
      name: p.name,
      subtitle: p.subtitle,
      createdAt: p.createdAt.toISOString(),
      memberCount: p._count.members,
    }));

    return NextResponse.json(mapped);
  } catch (error) {
    console.error('Error fetching admin projects:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
