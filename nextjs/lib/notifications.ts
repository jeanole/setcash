// ============================================================================
// Notification Helpers
// ============================================================================

import { db as prisma } from '@/lib/db';

/**
 * Notify all project admins (role = 'admin' or 'owner') about an event.
 * Fire-and-forget — errors are swallowed so callers are never blocked.
 */
export async function notifyProjectAdmins(
  projectId: string,
  type: string,
  message: string
): Promise<void> {
  const adminMembers = await prisma.projectMember.findMany({
    where: {
      projectId,
      role: { in: ['admin', 'owner'] },
    },
    select: { userEmail: true },
  });

  const emails = adminMembers.map((m) => m.userEmail);

  if (emails.length === 0) return;

  await prisma.$transaction(
    emails.map((userEmail) =>
      prisma.notification.create({
        data: { userEmail, type, message, projectId },
      })
    )
  );
}
