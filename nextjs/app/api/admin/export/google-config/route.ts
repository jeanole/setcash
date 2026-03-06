// ============================================================================
// GET/POST /api/admin/export/google-config
// ============================================================================
// GET:  Returns Google Sheets configuration status
// POST: Updates Google Sheet ID and optionally saves credentials file
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { getCredentialsPath, saveCredentials, validateCredentialsJson } from '@/lib/google';
import { z } from 'zod';

const PostSchema = z.object({
  sheetId: z.string().optional(),
  credentialsJson: z.string().optional(),
});

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

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const hasCredentials = getCredentialsPath() !== null;

    const sheetIdSetting = await prisma.projectSettings.findUnique({
      where: { projectId_key: { projectId, key: 'exportSheetId' } },
    });
    const sheetId = sheetIdSetting?.value ?? null;

    let status: 'green' | 'yellow' | 'red';
    if (hasCredentials && sheetId) {
      status = 'green';
    } else if (hasCredentials || sheetId) {
      status = 'yellow';
    } else {
      status = 'red';
    }

    return NextResponse.json({ hasCredentials, sheetId, status });
  } catch (error) {
    console.error('Google config GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const parseResult = PostSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { sheetId, credentialsJson } = parseResult.data;

    // Save Sheet ID if provided
    if (sheetId !== undefined) {
      await prisma.projectSettings.upsert({
        where: { projectId_key: { projectId, key: 'exportSheetId' } },
        update: { value: sheetId || null },
        create: { projectId, key: 'exportSheetId', value: sheetId || null },
      });
    }

    // Save credentials if provided
    if (credentialsJson) {
      const validation = validateCredentialsJson(credentialsJson);
      if (!validation.valid) {
        return NextResponse.json(
          { error: `Invalid credentials: ${validation.error}` },
          { status: 400 }
        );
      }
      saveCredentials(credentialsJson);
    }

    // Return updated status
    const hasCredentials = getCredentialsPath() !== null;
    const sheetIdSetting = await prisma.projectSettings.findUnique({
      where: { projectId_key: { projectId, key: 'exportSheetId' } },
    });
    const currentSheetId = sheetIdSetting?.value ?? null;

    let status: 'green' | 'yellow' | 'red';
    if (hasCredentials && currentSheetId) {
      status = 'green';
    } else if (hasCredentials || currentSheetId) {
      status = 'yellow';
    } else {
      status = 'red';
    }

    return NextResponse.json({ ok: true, hasCredentials, sheetId: currentSheetId, status });
  } catch (error) {
    console.error('Google config POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
