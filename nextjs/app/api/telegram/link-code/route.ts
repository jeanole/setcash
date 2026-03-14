// ============================================================================
// GET /api/telegram/link-code
// ============================================================================
// Generate a one-time Telegram link code for the current user.
// Requires Telegram to be enabled for the current project.
// ============================================================================

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { generateLinkCode } from '@/lib/telegram/codes';
import { telegramLinkCodeLimiter } from '@/lib/ratelimit';

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

    const userEmail = session.user.email;
    if (!userEmail) {
      return NextResponse.json({ error: 'No email associated with account' }, { status: 400 });
    }

    // Rate limit by user email
    const { success } = await telegramLinkCodeLimiter.limit(userEmail);
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    // Check if Telegram is enabled for this project
    const telegramEnabledSetting = await prisma.projectSettings.findUnique({
      where: { projectId_key: { projectId, key: 'telegramEnabled' } },
    });
    const telegramEnabled =
      telegramEnabledSetting?.value === 'true' ||
      telegramEnabledSetting?.value === '"true"' ||
      telegramEnabledSetting?.value === '1';

    if (!telegramEnabled) {
      return NextResponse.json(
        { error: 'Telegram not enabled for this project' },
        { status: 400 }
      );
    }

    const { code, expires } = await generateLinkCode(userEmail, projectId);

    return NextResponse.json({ code, expires });
  } catch (error) {
    console.error('Error generating Telegram link code:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
