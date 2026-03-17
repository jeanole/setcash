// ============================================================================
// Bill Comments API - PATCH (edit) / DELETE (delete)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';
import { z } from 'zod';
import { parseMentions } from '@/lib/mentions';

const updateCommentSchema = z.object({
  text: z.string().trim().min(1).max(2000),
});

// PATCH /api/bills/[id]/comments/[commentId] - Edit own comment
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = session.user.currentProjectId;
    if (!projectId) {
      return NextResponse.json({ error: 'No project selected' }, { status: 400 });
    }

    // Verify project membership
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userEmail: {
          projectId,
          userEmail: session.user.email,
        },
      },
    });

    if (!membership && session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Validate request body
    const body = await req.json();
    const validation = updateCommentSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { text: newText } = validation.data;
    const { id: billId, commentId } = await params;

    // Fetch the comment, scoped to project and bill
    const log = await prisma.editLog.findFirst({
      where: {
        id: commentId,
        billId,
        source: 'comment',
        projectId,
      },
    });

    if (!log) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Only the comment author can edit
    if (log.user.toLowerCase() !== session.user.email.toLowerCase()) {
      return NextResponse.json({ error: 'Forbidden: only the comment author can edit' }, { status: 403 });
    }

    // Resolve new @mentions
    const projectMembers = await prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: {
          select: { email: true, firstName: true, lastName: true, username: true },
        },
      },
    });

    const memberProfiles = projectMembers
      .filter((m) => m.user !== null)
      .map((m) => ({
        email: m.user!.email,
        firstName: m.user!.firstName,
        lastName: m.user!.lastName,
        username: m.user!.username,
      }));

    const newMentions = parseMentions(newText, memberProfiles);

    // Determine newly-mentioned users (in new mentions but not in old)
    const oldChanges = log.changes as Record<string, unknown>;
    const oldMentions: string[] = Array.isArray(oldChanges.mentions)
      ? (oldChanges.mentions as string[])
      : [];
    const oldMentionsSet = new Set(oldMentions.map((e) => e.toLowerCase()));
    const newlyMentioned = newMentions.filter(
      (e) => !oldMentionsSet.has(e.toLowerCase())
    );

    const commenterName =
      session.user.name || session.user.email.split('@')[0];

    // Fetch bill number for notification message
    const bill = await prisma.bill.findFirst({
      where: { id: billId, projectId },
      select: { billNumber: true },
    });
    const billLabel = bill?.billNumber ? `#${bill.billNumber}` : 'bill';

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.editLog.update({
        where: { id: commentId },
        data: {
          changes: {
            _event: 'comment',
            text: newText,
            mentions: newMentions,
            editedAt: new Date().toISOString(),
          },
        },
      });

      // Notify newly @mentioned members (excluding the commenter)
      for (const mentionedEmail of newlyMentioned) {
        if (mentionedEmail.toLowerCase() === session.user.email.toLowerCase()) {
          continue;
        }
        await tx.notification.create({
          data: {
            userEmail: mentionedEmail,
            type: 'bill_mention',
            message: `${commenterName} mentioned you in a comment on ${billLabel}`,
            projectId,
          },
        });
      }

      return result;
    });

    return NextResponse.json({
      id: updated.id,
      timestamp: updated.timestamp.toISOString(),
      user: updated.user,
      billId: updated.billId,
      changes: updated.changes as Record<string, unknown>,
      source: updated.source,
    });
  } catch (error) {
    console.error('Error updating comment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/bills/[id]/comments/[commentId] - Delete comment (author or admin)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = session.user.currentProjectId;
    if (!projectId) {
      return NextResponse.json({ error: 'No project selected' }, { status: 400 });
    }

    // Verify project membership and capture role
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userEmail: {
          projectId,
          userEmail: session.user.email,
        },
      },
    });

    const isSuperAdmin = session.user.role === 'superadmin';

    if (!membership && !isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: billId, commentId } = await params;

    // Fetch the comment, scoped to project and bill
    const log = await prisma.editLog.findFirst({
      where: {
        id: commentId,
        billId,
        source: 'comment',
        projectId,
      },
    });

    if (!log) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Allow deletion if: author, project admin/owner, or superadmin
    const isAuthor = log.user.toLowerCase() === session.user.email.toLowerCase();
    const isProjectAdmin =
      membership !== null &&
      (membership.role === 'admin' || membership.role === 'owner');

    if (!isAuthor && !isProjectAdmin && !isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.editLog.delete({ where: { id: commentId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
