// ============================================================================
// Edit Log API - GET
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';
import { z } from 'zod';

const getLogsQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 100))
    .pipe(z.number().int().min(1).max(500)),
});

// GET /api/bills/log - Get edit history for current project
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

    // Verify project access
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

    // Parse and validate limit param
    const { searchParams } = new URL(req.url);
    const queryParsed = getLogsQuerySchema.safeParse({
      limit: searchParams.get('limit') ?? undefined,
    });
    if (!queryParsed.success) {
      return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
    }
    const { limit } = queryParsed.data;

    const logs = await prisma.editLog.findMany({
      where: { projectId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    const mapped = logs.map((l) => ({
      id: l.id,
      timestamp: l.timestamp.toISOString(),
      user: l.user,
      billId: l.billId,
      changes: l.changes as Record<string, unknown>,
      source: l.source,
    }));

    return NextResponse.json(mapped);
  } catch (error) {
    console.error('Error fetching edit logs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
