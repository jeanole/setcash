// ============================================================================
// Project Member Names API - GET
// Lightweight endpoint accessible to any project member (not admin-gated).
// Used for @mention autocomplete in bill comments.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';

// GET /api/projects/[id]/members/names - List member names for @mention autocomplete
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await params;

    // Verify the requesting user is a member of this project
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userEmail: {
          projectId,
          userEmail: session.user.email,
        },
      },
    });

    const isSuperAdmin = session.user.role === 'superadmin';

    if (!membership && !isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch all members with their user profile details
    const members = await prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
            username: true,
          },
        },
      },
    });

    const response = members
      .filter((m) => m.user !== null)
      .map((m) => ({
        email: m.user!.email,
        firstName: m.user!.firstName,
        lastName: m.user!.lastName,
        username: m.user!.username,
      }));

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching member names:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
