// ============================================================================
// Bill Comments API - POST (create comment)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';
import { z } from 'zod';
import { commentCreateLimiter } from '@/lib/ratelimit';
import { parseMentions } from '@/lib/mentions';

const createCommentSchema = z.object({
  text: z.string().trim().min(1).max(2000),
});

// POST /api/bills/[id]/comments - Create a comment on a bill
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
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

    // Rate limiting
    const rateLimitKey = session.user.id || session.user.email;
    const { success: rateLimitOk } = await commentCreateLimiter.limit(rateLimitKey);
    if (!rateLimitOk) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before posting another comment.' },
        { status: 429 }
      );
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
    const validation = createCommentSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { text } = validation.data;
    const { id: billId } = params;

    // Verify bill exists in this project
    const bill = await prisma.bill.findFirst({
      where: { id: billId, projectId },
      select: { id: true, submittedByEmail: true, billNumber: true },
    });

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    // Resolve @mentions — fetch all project members with user info
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

    const mentions = parseMentions(text, memberProfiles);

    // Build notification details
    const commenterName =
      session.user.name ||
      session.user.email.split('@')[0];
    const billLabel = bill.billNumber ? `#${bill.billNumber}` : `bill`;

    // Execute in a transaction
    const log = await prisma.$transaction(async (tx) => {
      // Create the comment as an EditLog row
      const created = await tx.editLog.create({
        data: {
          projectId,
          timestamp: new Date(),
          user: session.user.email,
          billId: bill.id,
          changes: {
            _event: 'comment',
            text,
            mentions,
            editedAt: null,
          },
          source: 'comment',
        },
      });

      // Notify bill submitter if they are not the commenter
      if (
        bill.submittedByEmail.toLowerCase() !== session.user.email.toLowerCase()
      ) {
        await tx.notification.create({
          data: {
            userEmail: bill.submittedByEmail,
            type: 'bill_comment',
            message: `${commenterName} commented on your ${billLabel}`,
            projectId,
          },
        });
      }

      // Notify @mentioned members (excluding the commenter)
      for (const mentionedEmail of mentions) {
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

      return created;
    });

    return NextResponse.json(
      {
        id: log.id,
        timestamp: log.timestamp.toISOString(),
        user: log.user,
        billId: log.billId,
        changes: log.changes as Record<string, unknown>,
        source: log.source,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
