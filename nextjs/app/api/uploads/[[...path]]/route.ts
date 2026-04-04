// ============================================================================
// File Serving API - GET
// ============================================================================
// Serves uploaded images with project access verification
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma, withDbRetry } from '@/lib/db';
import fs from 'fs';
import path from 'path';
import { UPLOADS_DIR } from '@/lib/upload';

// GET /uploads/[...path] - Serve uploaded file
export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const pathSegments = params.path;
    if (!pathSegments || pathSegments.length === 0) {
      return new NextResponse('Not found', { status: 404 });
    }

    const relPath = pathSegments.join('/');

    // Look up image by file path in bill_images first
    const image = await withDbRetry(() =>
      prisma.billImage.findFirst({
        where: { filePath: relPath },
        include: {
          bill: {
            select: { projectId: true },
          },
        },
      })
    );

    let targetProjectId: string | null = null;

    if (image) {
      targetProjectId = image.bill.projectId;
    } else {
      // Fallback to legacy bill lookup
      const bill = await withDbRetry(() =>
        prisma.bill.findFirst({
          where: { filename: relPath },
          select: { projectId: true },
        })
      );
      if (bill) {
        targetProjectId = bill.projectId;
      }
    }

    if (!targetProjectId) {
      return new NextResponse('Not found', { status: 404 });
    }

    // Check access - super admins can access any project
    const isSuperAdmin = session.user.role === 'superadmin';
    if (!isSuperAdmin && session.user.currentProjectId !== targetProjectId) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    // Serve the file
    const filePath = path.join(UPLOADS_DIR, relPath);

    if (!fs.existsSync(filePath)) {
      return new NextResponse('Not found', { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();

    // Determine content type
    const contentType =
      ext === '.png'
        ? 'image/png'
        : ext === '.gif'
          ? 'image/gif'
          : ext === '.webp'
            ? 'image/webp'
            : ext === '.pdf'
              ? 'application/pdf'
              : 'image/jpeg';

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error serving file:', error);

    // Return 503 for transient database connection errors so clients know to retry.
    const msg = error instanceof Error ? error.message.toLowerCase() : '';
    if (
      msg.includes('the database system is not yet accepting connections') ||
      msg.includes('connection refused') ||
      msg.includes('econnrefused') ||
      msg.includes('cannot connect now')
    ) {
      return new NextResponse('Service temporarily unavailable', {
        status: 503,
        headers: { 'Retry-After': '5' },
      });
    }

    return new NextResponse('Internal server error', { status: 500 });
  }
}
