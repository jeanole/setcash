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
import { verifyProjectMember } from '@/lib/auth-guard';

// GET /uploads/[...path] - Serve uploaded file
export async function GET(req: NextRequest, props: { params: Promise<{ path?: string[] }> }) {
  const params = await props.params;
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
      // Fallback to legacy bill lookup (rows imported before bill_images existed).
      // Only bills WITHOUT image rows qualify: for everything else bill.filename
      // is just a mirror of the first image, and older rows may hold a
      // client-supplied name that must never grant access to someone else's file.
      const bill = await withDbRetry(() =>
        prisma.bill.findFirst({
          where: { filename: relPath, images: { none: {} } },
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

    // Check access - users view images of their current project only (super
    // admins may open any project)...
    const isSuperAdmin = session.user.role === 'superadmin';
    if (!isSuperAdmin && session.user.currentProjectId !== targetProjectId) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    // ...and must be a member of that project according to the DB, not just
    // according to the (possibly stale) JWT claims. Superadmin status is
    // re-read from the DB here too.
    const memberCheck = await withDbRetry(() =>
      verifyProjectMember(session.user.email, targetProjectId as string)
    );
    if (!memberCheck.authorized) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    // Serve the file — guard against path traversal before touching the filesystem
    const filePath = path.join(UPLOADS_DIR, relPath);
    const resolved = path.resolve(filePath);
    const root = path.resolve(UPLOADS_DIR);
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    if (!fs.existsSync(resolved)) {
      return new NextResponse('Not found', { status: 404 });
    }

    const ext = path.extname(resolved).toLowerCase();

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

    // Stream the file instead of loading it entirely into memory
    const readableStream = new ReadableStream({
      start(controller) {
        const stream = fs.createReadStream(resolved);
        stream.on('data', (chunk: string | Buffer) => controller.enqueue(chunk));
        stream.on('end', () => controller.close());
        stream.on('error', (err: Error) => controller.error(err));
      },
    });

    return new NextResponse(readableStream, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
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
