// ============================================================================
// Superadmin System Config API - GET + PATCH
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';
import { z } from 'zod';

const patchSystemConfigSchema = z.object({
  defaultUploadLimit: z.number().int().min(1).nullable().optional(),
});

// GET /api/superadmin/system-config - Fetch all system config values
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rows = await prisma.systemConfig.findMany();
    const configMap = Object.fromEntries(rows.map((r) => [r.key, r.value]));

    const defaultUploadLimitRaw = configMap['defaultUploadLimit'];
    const defaultUploadLimit =
      defaultUploadLimitRaw != null ? parseInt(defaultUploadLimitRaw, 10) : null;

    return NextResponse.json({
      defaultUploadLimit: Number.isFinite(defaultUploadLimit) ? defaultUploadLimit : null,
    });
  } catch (error) {
    console.error('Error fetching system config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/superadmin/system-config - Update system config values
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = patchSystemConfigSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const updates: Array<{ key: string; value: string | null }> = [];

    if ('defaultUploadLimit' in parsed.data) {
      updates.push({
        key: 'defaultUploadLimit',
        value: parsed.data.defaultUploadLimit != null
          ? String(parsed.data.defaultUploadLimit)
          : null,
      });
    }

    for (const { key, value } of updates) {
      await prisma.systemConfig.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error updating system config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
