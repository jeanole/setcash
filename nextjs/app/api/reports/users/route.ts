// ============================================================================
// GET /api/reports/users
// ============================================================================
// Returns list of users for the report dropdown.
// Admins see all project members who have bills; regular users see only self.
// ============================================================================

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = session.user.currentProjectId;
    if (!projectId) {
      return NextResponse.json({ error: 'No project selected' }, { status: 400 });
    }

    const isAdmin =
      session.user.role === 'superadmin' ||
      session.user.currentProjectRole === 'admin' ||
      session.user.currentProjectRole === 'owner';

    if (isAdmin) {
      // Admins see all project members who have bills — join via bill submitters
      const usersWithBills = await prisma.$queryRaw<{ email: string; role_name: string }[]>`
        SELECT DISTINCT b."submittedByEmail" as email,
               COALESCE(pp.name, 'Misc') as role_name
        FROM "Bill" b
        LEFT JOIN "ProjectMember" pm
          ON LOWER(pm."userEmail") = LOWER(b."submittedByEmail")
          AND pm."projectId" = b."projectId"
        LEFT JOIN "ProjectPosition" pp ON pp.id = pm."positionId"
        WHERE b."projectId" = ${projectId}
        ORDER BY b."submittedByEmail"
      `;

      return NextResponse.json(
        usersWithBills.map((u) => ({ email: u.email, roleName: u.role_name }))
      );
    } else {
      // Regular users see only themselves with their position name
      const member = await prisma.projectMember.findFirst({
        where: {
          projectId,
          userEmail: { equals: session.user.email, mode: 'insensitive' },
        },
        include: { position: true },
      });

      const roleName = member?.position?.name ?? 'Misc';
      return NextResponse.json([{ email: session.user.email, roleName }]);
    }
  } catch (error) {
    console.error('Error fetching report users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
