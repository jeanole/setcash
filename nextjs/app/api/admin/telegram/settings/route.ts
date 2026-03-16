// ============================================================================
// GET/PUT /api/admin/telegram/settings
// ============================================================================
// Manages Telegram bot token and enabled state for the current project.
// Token is encrypted at rest using the Telegram encryption module (AES-256-GCM,
// keyed by TELEGRAM_ENCRYPTION_KEY) — NOT the OCR key — so the bot can decrypt it.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { encrypt, decrypt } from '@/lib/telegram/encryption';
import { startProjectBot, stopProjectBot } from '@/lib/telegram/bot';

const BOT_TOKEN_PATTERN = /^\d+:[A-Za-z0-9_-]+$/;

const updateSchema = z.object({
  telegramBotToken: z.string().optional(),
  telegramEnabled: z.boolean().optional(),
});

function isAdmin(session: { user?: { role?: string | null; currentProjectRole?: string | null } | null }) {
  return (
    session.user?.role === 'superadmin' ||
    session.user?.currentProjectRole === 'admin' ||
    session.user?.currentProjectRole === 'owner'
  );
}

/** Mask a stored (possibly encrypted) token for display. Decrypts, then shows last 4 chars. */
function maskToken(stored: string): string {
  const plain = decrypt(stored);
  if (!plain) return '••••••••••••';
  // Show last 4 chars of the plaintext token
  return `...${plain.slice(-4)}`;
}

// ── GET /api/admin/telegram/settings ──────────────────────────────────────────

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const projectId = session.user.currentProjectId;
  if (!projectId) {
    return NextResponse.json({ error: 'No project selected' }, { status: 400 });
  }

  const rows = await prisma.projectSettings.findMany({
    where: { projectId, key: { in: ['telegramBotToken', 'telegramEnabled'] } },
  });

  const map = Object.fromEntries(rows.map((r) => [r.key, r.value ?? '']));

  const enabled =
    map.telegramEnabled === 'true' ||
    map.telegramEnabled === '"true"' ||
    map.telegramEnabled === '1';

  const maskedToken = map.telegramBotToken ? maskToken(map.telegramBotToken) : null;

  return NextResponse.json({ telegramEnabled: enabled, telegramBotToken: maskedToken });
}

// ── PUT /api/admin/telegram/settings ──────────────────────────────────────────

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const projectId = session.user.currentProjectId;
  if (!projectId) {
    return NextResponse.json({ error: 'No project selected' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { telegramBotToken, telegramEnabled } = parsed.data;

  const upserts: Promise<unknown>[] = [];

  if (telegramBotToken !== undefined) {
    if (telegramBotToken === '') {
      upserts.push(
        prisma.projectSettings.deleteMany({ where: { projectId, key: 'telegramBotToken' } })
      );
    } else if (!telegramBotToken.startsWith('...')) {
      // Validate format before storing
      if (!BOT_TOKEN_PATTERN.test(telegramBotToken)) {
        return NextResponse.json(
          { error: 'Invalid bot token format. Should be like: 123456789:ABCdefGHIjklMNOpqrSTUvwxyz' },
          { status: 400 }
        );
      }
      // Validate against Telegram API before storing
      let botUsername: string | undefined;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        let tgRes: Response;
        try {
          tgRes = await fetch(`https://api.telegram.org/bot${telegramBotToken}/getMe`, {
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }
        const tgData = await tgRes.json();
        if (!tgData.ok) {
          return NextResponse.json(
            { error: `Token rejected by Telegram: ${tgData.description ?? 'Invalid token'}` },
            { status: 400 }
          );
        }
        botUsername = tgData.result?.username as string | undefined;
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          return NextResponse.json(
            { error: 'Telegram API did not respond in time. Please try again.' },
            { status: 504 }
          );
        }
        return NextResponse.json(
          { error: 'Could not reach Telegram to validate token. Check network connectivity.' },
          { status: 502 }
        );
      }
      // Encrypt with the Telegram encryption module so the bot can decrypt it
      const encrypted = encrypt(telegramBotToken);
      upserts.push(
        prisma.projectSettings.upsert({
          where: { projectId_key: { projectId, key: 'telegramBotToken' } },
          create: { projectId, key: 'telegramBotToken', value: encrypted },
          update: { value: encrypted },
        })
      );
      // Store bot username for deep link generation
      if (botUsername) {
        upserts.push(
          prisma.projectSettings.upsert({
            where: { projectId_key: { projectId, key: 'telegramBotUsername' } },
            create: { projectId, key: 'telegramBotUsername', value: botUsername },
            update: { value: botUsername },
          })
        );
      }
    }
    // If starts with '...', it's the masked value echoed back — don't overwrite
  }

  if (telegramEnabled !== undefined) {
    upserts.push(
      prisma.projectSettings.upsert({
        where: { projectId_key: { projectId, key: 'telegramEnabled' } },
        create: { projectId, key: 'telegramEnabled', value: String(telegramEnabled) },
        update: { value: String(telegramEnabled) },
      })
    );
  }

  await Promise.all(upserts);

  // Start or stop bot based on new enabled state
  if (telegramEnabled === true) {
    startProjectBot(projectId).catch((err) =>
      console.error(`[TG ${projectId}] Failed to start bot after settings update:`, err)
    );
  } else if (telegramEnabled === false) {
    stopProjectBot(projectId);
  }

  // Return updated state with masked token
  const rows = await prisma.projectSettings.findMany({
    where: { projectId, key: { in: ['telegramBotToken', 'telegramEnabled'] } },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value ?? '']));
  const enabled =
    map.telegramEnabled === 'true' ||
    map.telegramEnabled === '"true"' ||
    map.telegramEnabled === '1';
  const maskedToken = map.telegramBotToken ? maskToken(map.telegramBotToken) : null;

  return NextResponse.json({ telegramEnabled: enabled, telegramBotToken: maskedToken });
}
