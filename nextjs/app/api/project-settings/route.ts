// ============================================================================
// Project Settings API - GET / PUT
// ============================================================================
// Manages project-level OCR configuration settings (ocrEnabled, ocrProvider,
// ocrApiKey, ocrBaseUrl). API key is encrypted at rest; masked on GET.
// Access restricted to project admin, owner, and superadmin.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';
import { z } from 'zod';
import { encryptApiKey, maskApiKey } from '@/lib/ocr';

// ── Validation schema ─────────────────────────────────────────────────────────

const updateSettingsSchema = z.object({
  ocrEnabled: z.boolean().optional(),
  ocrProvider: z.enum(['openai', 'gemini', 'claude', 'custom', 'qwen25vl', 'qwen3vl', 'deepseek']).optional(),
  ocrApiKey: z.string().optional(),
  ocrBaseUrl: z.string().url().nullable().optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Read all ProjectSettings rows for a project and return a typed settings object.
 * The ocrApiKey is returned as a masked value (e.g. "...abc4") — never plaintext.
 */
async function readProjectSettings(projectId: string): Promise<{
  ocrEnabled: boolean;
  ocrProvider: string | null;
  ocrApiKey: string | null;
  ocrBaseUrl: string | null;
}> {
  const rows = await prisma.projectSettings.findMany({
    where: { projectId },
  });

  const map: Record<string, string | null> = {};
  for (const row of rows) {
    map[row.key] = row.value ?? null;
  }

  // Parse typed values
  let ocrEnabled = false;
  try {
    ocrEnabled = map.ocrEnabled != null ? JSON.parse(map.ocrEnabled) === true : false;
  } catch {}

  const ocrProvider = map.ocrProvider ?? null;
  const ocrBaseUrl = map.ocrBaseUrl ?? null;

  // Mask the API key — never return plaintext
  const ocrApiKey = map.ocrApiKey ? maskApiKey(map.ocrApiKey) : null;

  return { ocrEnabled, ocrProvider, ocrApiKey, ocrBaseUrl };
}

// ── GET /api/project-settings ─────────────────────────────────────────────────

export async function GET(_req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = session.user.currentProjectId;
    if (!projectId) {
      return NextResponse.json({ error: 'No project selected' }, { status: 400 });
    }

    // Only admin, owner, or superadmin may read project settings
    const role = session.user.role;
    if (role !== 'admin' && role !== 'superadmin') {
      // Check if the user is an owner via project membership
      const membership = await prisma.projectMember.findUnique({
        where: {
          projectId_userEmail: {
            projectId,
            userEmail: session.user.email,
          },
        },
        select: { role: true },
      });

      if (!membership || membership.role !== 'owner') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const settings = await readProjectSettings(projectId);
    return NextResponse.json(settings);
  } catch (error) {
    console.error('[project-settings] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── PUT /api/project-settings ─────────────────────────────────────────────────

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = session.user.currentProjectId;
    if (!projectId) {
      return NextResponse.json({ error: 'No project selected' }, { status: 400 });
    }

    // Only admin, owner, or superadmin may write project settings
    const role = session.user.role;
    if (role !== 'admin' && role !== 'superadmin') {
      // Check if the user is an owner via project membership
      const membership = await prisma.projectMember.findUnique({
        where: {
          projectId_userEmail: {
            projectId,
            userEmail: session.user.email,
          },
        },
        select: { role: true },
      });

      if (!membership || membership.role !== 'owner') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parseResult = updateSettingsSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.flatten() },
        { status: 422 }
      );
    }

    const data = parseResult.data;

    // Upsert each provided setting individually
    const upsertPromises: Promise<unknown>[] = [];

    if (data.ocrEnabled !== undefined) {
      upsertPromises.push(
        prisma.projectSettings.upsert({
          where: { projectId_key: { projectId, key: 'ocrEnabled' } },
          create: { projectId, key: 'ocrEnabled', value: JSON.stringify(data.ocrEnabled) },
          update: { value: JSON.stringify(data.ocrEnabled) },
        })
      );
    }

    if (data.ocrProvider !== undefined) {
      upsertPromises.push(
        prisma.projectSettings.upsert({
          where: { projectId_key: { projectId, key: 'ocrProvider' } },
          create: { projectId, key: 'ocrProvider', value: data.ocrProvider },
          update: { value: data.ocrProvider },
        })
      );
    }

    if (data.ocrApiKey !== undefined) {
      if (data.ocrApiKey === '') {
        // Empty string means the user is clearing the API key — delete the setting
        upsertPromises.push(
          prisma.projectSettings.deleteMany({
            where: { projectId, key: 'ocrApiKey' },
          })
        );
      } else if (!data.ocrApiKey.startsWith('...')) {
        // Not already masked — encrypt before storing
        const encrypted = encryptApiKey(data.ocrApiKey);
        upsertPromises.push(
          prisma.projectSettings.upsert({
            where: { projectId_key: { projectId, key: 'ocrApiKey' } },
            create: { projectId, key: 'ocrApiKey', value: encrypted },
            update: { value: encrypted },
          })
        );
      }
      // If the key starts with '...', it is the masked value echoed back from the
      // frontend — do not overwrite the stored encrypted value.
    }

    if (data.ocrBaseUrl !== undefined) {
      if (data.ocrBaseUrl === null) {
        // Null means remove the base URL setting
        upsertPromises.push(
          prisma.projectSettings.deleteMany({
            where: { projectId, key: 'ocrBaseUrl' },
          })
        );
      } else {
        upsertPromises.push(
          prisma.projectSettings.upsert({
            where: { projectId_key: { projectId, key: 'ocrBaseUrl' } },
            create: { projectId, key: 'ocrBaseUrl', value: data.ocrBaseUrl },
            update: { value: data.ocrBaseUrl },
          })
        );
      }
    }

    await Promise.all(upsertPromises);

    // Return updated settings with masked API key
    const updated = await readProjectSettings(projectId);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[project-settings] PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
