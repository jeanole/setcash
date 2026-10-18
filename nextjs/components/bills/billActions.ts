// ============================================================================
// Which status actions the bill detail page may offer
// ============================================================================
// Mirrors the rules of PATCH /api/bills/[id]/status (ALLOWED_TRANSITIONS plus
// its authorization): admins may approve/reject along the allowed transitions;
// the author of a bill may only send their own confirmed bill back to draft.
// Self-approval is not permitted by the API, so it is never offered here.
// ============================================================================

export interface BillStatusActions {
  approve: boolean;
  reject: boolean;
  revertToDraft: boolean;
}

const APPROVE_FROM = ['confirmed', 'pending'];
const REJECT_FROM = ['draft', 'confirmed', 'pending', 'approved'];

export function getBillStatusActions(
  status: string | undefined,
  role: { isAdmin: boolean; isAuthor: boolean }
): BillStatusActions {
  if (!status) return { approve: false, reject: false, revertToDraft: false };
  return {
    approve: role.isAdmin && APPROVE_FROM.includes(status),
    reject: role.isAdmin && REJECT_FROM.includes(status),
    revertToDraft: role.isAuthor && !role.isAdmin && status === 'confirmed',
  };
}
