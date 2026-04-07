// ============================================================================
// V-Geld API - DELETE /api/vgeld/[id] + PATCH /api/vgeld/[id] (confirm)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';

// PATCH /api/vgeld/[id] - Confirm a V-Geld transfer (admin/owner/superadmin only)
export async function PATCH(
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

    // Verify project membership and admin/owner role
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userEmail: {
          projectId,
          userEmail: session.user.email,
        },
      },
    });

    const isSuperAdmin = session.user.role === 'superadmin';
    const isAdmin = membership?.role === 'admin' || membership?.role === 'owner';

    if (!isSuperAdmin && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 });
    }

    const { id } = params;

    // Verify the transfer exists and belongs to this project
    const transfer = await prisma.vgeld.findUnique({
      where: { id },
    });

    if (!transfer || transfer.projectId !== projectId) {
      return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });
    }

    if (transfer.confirmedBy) {
      return NextResponse.json({ error: 'Transfer already confirmed' }, { status: 400 });
    }

    await prisma.vgeld.update({
      where: { id },
      data: { confirmedBy: session.user.email },
    });

    // Fire-and-forget: notify the transfer requester
    if (transfer.createdBy) {
      void Promise.resolve().then(async () => {
        try {
          const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { name: true },
          });
          const projectName = project?.name ?? projectId;
          const amountStr = Number(transfer.amount).toFixed(2);
          await prisma.notification.create({
            data: {
              userEmail: transfer.createdBy as string,
              type: 'transfer_confirmed',
              message: `Your transfer of ${amountStr} in '${projectName}' was confirmed.`,
              projectId,
            },
          });
        } catch {
          // ignore
        }
      });
    }

    return NextResponse.json({ ok: true, confirmedBy: session.user.email });
  } catch (error) {
    console.error('Error confirming V-Geld transfer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/vgeld/[id] - Delete a V-Geld transfer
export async function DELETE(
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

    // Verify project membership and admin role
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userEmail: {
          projectId,
          userEmail: session.user.email,
        },
      },
    });

    const isSuperAdmin = session.user.role === 'superadmin';
    const isAdmin = membership?.role === 'admin' || membership?.role === 'owner';

    if (!isSuperAdmin && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 });
    }

    const { id } = params;

    // Verify the transfer exists and belongs to this project
    const transfer = await prisma.vgeld.findUnique({
      where: { id },
    });

    if (!transfer || transfer.projectId !== projectId) {
      return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });
    }

    await prisma.vgeld.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error deleting V-Geld transfer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
