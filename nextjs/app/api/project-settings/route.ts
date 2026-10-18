// ============================================================================
// Project Settings API - GET / PUT
// ============================================================================
// Manages project-level OCR configuration settings (ocrEnabled, ocrProvider,
// ocrApiKey, ocrBaseUrl). API key is encrypted at rest; masked on GET.
// Access restricted to project admin, owner, and superadmin (verified in the DB,
// not from JWT claims — the settings drive where the decrypted API key is sent).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { verifyAdminRole } from '@/lib/auth-guard';
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

    // Only admin, owner, or superadmin may read project settings (DB-verified)
    const guard = await verifyAdminRole(session.user.email, projectId);
    if (!guard.authorized) return guard.response!;

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

    // Block demo accounts from modifying project settings
    if (session.user.isDemoAccount && session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Demo accounts cannot modify project settings.' }, { status: 403 });
    }

    // Only admin, owner, or superadmin may write project settings (DB-verified)
    const guard = await verifyAdminRole(session.user.email, projectId);
    if (!guard.authorized) return guard.response!;

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

    // A new API key is only "provided" if it is non-empty and not the masked
    // value echoed back by the frontend.
    const newKeyProvided =
      data.ocrApiKey !== undefined && data.ocrApiKey !== '' && !data.ocrApiKey.startsWith('...');
    const clearingKey = data.ocrApiKey === '';

    // Never let a stored key follow a changed destination: if the provider or the
    // (non-null) base URL changes, the caller must supply a fresh key in the same
    // request (or explicitly clear it). Otherwise an admin could redirect the
    // existing key to a host they control.
    if (!newKeyProvided && !clearingKey) {
      const current = await prisma.projectSettings.findMany({
        where: { projectId, key: { in: ['ocrProvider', 'ocrBaseUrl', 'ocrApiKey'] } },
        select: { key: true, value: true },
      });
      const stored = Object.fromEntries(current.map((r) => [r.key, r.value]));

      if (stored.ocrApiKey) {
        // An unset provider means the OCR default ('openai', see lib/ocr.ts)
        const providerChanged =
          data.ocrProvider !== undefined && data.ocrProvider !== (stored.ocrProvider || 'openai');
        const baseUrlChanged =
          typeof data.ocrBaseUrl === 'string' && data.ocrBaseUrl !== (stored.ocrBaseUrl ?? null);

        if (providerChanged || baseUrlChanged) {
          return NextResponse.json(
            { error: 'Changing the AI provider or base URL requires entering the API key again.' },
            { status: 400 }
          );
        }
      }
    }

    // Collect every write and apply them atomically
    const operations: Prisma.PrismaPromise<unknown>[] = [];

    if (data.ocrEnabled !== undefined) {
      operations.push(
        prisma.projectSettings.upsert({
          where: { projectId_key: { projectId, key: 'ocrEnabled' } },
          create: { projectId, key: 'ocrEnabled', value: JSON.stringify(data.ocrEnabled) },
          update: { value: JSON.stringify(data.ocrEnabled) },
        })
      );
    }

    if (data.ocrProvider !== undefined) {
      operations.push(
        prisma.projectSettings.upsert({
          where: { projectId_key: { projectId, key: 'ocrProvider' } },
          create: { projectId, key: 'ocrProvider', value: data.ocrProvider },
          update: { value: data.ocrProvider },
        })
      );
    }

    if (data.ocrApiKey !== undefined) {
      if (clearingKey) {
        // Empty string means the user is clearing the API key — delete the setting
        operations.push(
          prisma.projectSettings.deleteMany({
            where: { projectId, key: 'ocrApiKey' },
          })
        );
      } else if (newKeyProvided) {
        // Not already masked — encrypt before storing
        const encrypted = encryptApiKey(data.ocrApiKey);
        operations.push(
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
        operations.push(
          prisma.projectSettings.deleteMany({
            where: { projectId, key: 'ocrBaseUrl' },
          })
        );
      } else {
        operations.push(
          prisma.projectSettings.upsert({
            where: { projectId_key: { projectId, key: 'ocrBaseUrl' } },
            create: { projectId, key: 'ocrBaseUrl', value: data.ocrBaseUrl },
            update: { value: data.ocrBaseUrl },
          })
        );
      }
    }

    if (operations.length > 0) {
      await prisma.$transaction(operations);
    }

    // Return updated settings with masked API key
    const updated = await readProjectSettings(projectId);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[project-settings] PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
