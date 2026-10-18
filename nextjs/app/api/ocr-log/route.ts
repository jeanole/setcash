import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { verifyAdminRole } from '@/lib/auth-guard';
import { db as prisma } from '@/lib/db';
import { z } from 'zod';

const QuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// GET /api/ocr-log - Returns paginated OcrLog entries for the current project (admin only)
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

    const isAdmin =
      session.user.role === 'admin' ||
      session.user.role === 'owner' ||
      session.user.role === 'superadmin';

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Re-verify admin authority against the DB (JWT claims may be stale)
    const roleCheck = await verifyAdminRole(session.user.email, projectId);
    if (!roleCheck.authorized) return roleCheck.response!;

    const { searchParams } = new URL(req.url);
    // Empty/missing params fall back to the defaults; garbage is a 400, never a 500
    const parsedQuery = QuerySchema.safeParse({
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
    });
    if (!parsedQuery.success) {
      return NextResponse.json({ error: 'Invalid page or limit' }, { status: 400 });
    }
    const { page, limit } = parsedQuery.data;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.ocrLog.findMany({
        where: { projectId },
        select: {
          id: true,
          timestamp: true,
          provider: true,
          status: true,
          fieldsWritten: true,
          aiResponse: true,
          errorDetail: true,
          billId: true,
        },
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
      prisma.ocrLog.count({ where: { projectId } }),
    ]);

    return NextResponse.json({ logs, total, page, limit });
  } catch (error) {
    console.error('Error fetching OCR logs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
