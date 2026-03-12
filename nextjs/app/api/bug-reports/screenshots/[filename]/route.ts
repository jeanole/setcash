import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { UPLOADS_DIR } from '@/lib/upload';
import fs from 'fs';
import path from 'path';

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { filename } = await params;

  // Sanitize filename: only allow alphanumeric, hyphens, dots, underscores
  if (!/^[\w.-]+$/.test(filename)) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
  }

  const filePath = path.join(UPLOADS_DIR, 'bug-reports', filename);

  // Prevent path traversal
  const resolvedPath = path.resolve(filePath);
  const allowedDir = path.resolve(path.join(UPLOADS_DIR, 'bug-reports'));
  if (!resolvedPath.startsWith(allowedDir)) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
  }

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const ext = path.extname(filename).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  const fileBuffer = fs.readFileSync(filePath);

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
