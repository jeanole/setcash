import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';

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

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
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
