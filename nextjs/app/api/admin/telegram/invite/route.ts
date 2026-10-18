// ============================================================================
// POST /api/admin/telegram/invite
// ============================================================================
// Admin-only endpoint. Generates a Telegram deep link for a project member
// so they can link their account by clicking the link (bypassing /link CODE).
// The link is delivered ONLY to the target user via an in-app notification and
// is never returned to the calling admin — otherwise the admin could bind their
// own Telegram account to the member and file bills as them.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { generateLinkCode } from '@/lib/telegram/codes';
import { verifyAdminRole } from '@/lib/auth-guard';

const bodySchema = z.object({
  userEmail: z.string().email(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isAdmin =
    session.user.role === 'superadmin' ||
    session.user.currentProjectRole === 'admin' ||
    session.user.currentProjectRole === 'owner';

  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const projectId = session.user.currentProjectId;
  if (!projectId) {
    return NextResponse.json({ error: 'No project selected' }, { status: 400 });
  }

  const roleCheck = await verifyAdminRole(session.user.email, projectId);
  if (!roleCheck.authorized) return roleCheck.response!;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { userEmail } = parsed.data;

  // Verify user is a member of this project
  const member = await prisma.projectMember.findFirst({
    where: { projectId, userEmail },
  });
  if (!member) {
    return NextResponse.json(
      { error: 'User is not a member of this project' },
      { status: 400 }
    );
  }

  // Return 400 if already linked
  const existingLink = await prisma.telegramLink.findFirst({
    where: { projectId, userEmail },
  });
  if (existingLink) {
    return NextResponse.json(
      { error: 'This user already has a linked Telegram account' },
      { status: 400 }
    );
  }

  // Read bot username from ProjectSettings
  const botUsernameSetting = await prisma.projectSettings.findUnique({
    where: { projectId_key: { projectId, key: 'telegramBotUsername' } },
  });
  if (!botUsernameSetting?.value) {
    return NextResponse.json(
      {
        error:
          'Bot username is not set. Please re-save your Telegram bot token in Settings to populate it.',
      },
      { status: 400 }
    );
  }

  const botUsername = botUsernameSetting.value;

  // Generate link code
  const { code, expires } = await generateLinkCode(userEmail, projectId);

  const deepLink = `https://t.me/${botUsername}?start=${code}`;

  // Create in-app notification for the target user — store deepLink in message as JSON.
  // This is the only place the link/code is exposed.
  await prisma.notification.create({
    data: {
      userEmail,
      type: 'telegram_invite',
      message: JSON.stringify({
        text: 'An admin has sent you a Telegram bot invite link. Tap to open the bot and connect your account.',
        url: deepLink,
      }),
      projectId,
    },
  });

  // Do NOT return the code or deepLink to the caller.
  return NextResponse.json({ sent: true, expires });
}
