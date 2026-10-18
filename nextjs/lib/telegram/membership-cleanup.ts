// ============================================================================
// Membership removal side-effects
// ============================================================================
// When a user stops being a member of a project (removed by an admin, resigned,
// ...), anything that would still let them act in that project must go too:
//  - their Telegram link(s) and pending link codes for the project
//  - their default project pointer, if it points at the project
// Run inside the same transaction as the membership delete.
// ============================================================================

import type { Prisma } from '@prisma/client';

export async function cleanupAfterMemberRemoval(
  tx: Prisma.TransactionClient,
  projectId: string,
  userEmail: string
): Promise<void> {
  await tx.telegramLink.deleteMany({ where: { projectId, userEmail } });
  await tx.telegramLinkCode.deleteMany({ where: { projectId, userEmail } });
  await tx.user.updateMany({
    where: { email: userEmail, defaultProjectId: projectId },
    data: { defaultProjectId: null },
  });
}
