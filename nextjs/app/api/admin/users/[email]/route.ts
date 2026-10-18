// ============================================================================
// Admin User API - PUT (update/toggle admin/reset password), DELETE
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';
import { verifySuperAdmin } from '@/lib/auth-guard';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { randomBytes } from 'crypto';

// Validation schema for updating users (password reset, custom password, superadmin flag)
const UpdateUserSchema = z
  .object({
    resetPassword: z.boolean().optional(),
    password: z
      .string()
      .min(8)
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
        message:
          'Password must contain at least one uppercase letter, one lowercase letter, and one digit',
      })
      .optional(),
    isSuperAdmin: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.resetPassword === true ||
      data.password !== undefined ||
      data.isSuperAdmin !== undefined,
    {
      message: 'At least one field (password or isSuperAdmin) is required',
    }
  );

// Helper to find user by email (case-insensitive)
async function findUserByEmail(email: string) {
  return prisma.user.findFirst({
    where: {
      email: {
        equals: email,
        mode: 'insensitive',
      },
    },
  });
}

// PUT /api/admin/users/[email] - Update user (password reset or toggle admin)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is super-admin (DB-backed, not the JWT claim)
    if (session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const guard = await verifySuperAdmin(session.user.email);
    if (!guard.authorized) return guard.response!;

    const { email } = await params;
    const body = await req.json();

    // Validate the whole body (no raw body fields reach the database)
    const validation = UpdateUserSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }
    const data = validation.data;

    // Find user
    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Handle password reset (generate random password if requested)
    let plainPassword: string | undefined;
    const updates: {
      passwordHash?: string;
      isSuperAdmin?: boolean;
      sessionVersion?: { increment: number };
    } = {};

    if (data.resetPassword === true) {
      // Generate random 12-char password (9 bytes → 12 base64url chars, URL-safe alphabet)
      plainPassword = randomBytes(9).toString('base64url').slice(0, 12);
      updates.passwordHash = await bcrypt.hash(plainPassword, 12);
    } else if (data.password) {
      updates.passwordHash = await bcrypt.hash(data.password, 12);
    }

    // A new password ends every existing session (e.g. reset because the
    // account was compromised), same as the self-service change/reset flows.
    if (updates.passwordHash !== undefined) {
      updates.sessionVersion = { increment: 1 };
    }

    if (data.isSuperAdmin !== undefined) {
      updates.isSuperAdmin = data.isSuperAdmin;
    }

    // Ensure at least one field to update
    if (
      updates.passwordHash === undefined &&
      updates.isSuperAdmin === undefined
    ) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Removing the superadmin flag: never from yourself, never the last active superadmin.
    // The count and the write share a serializable transaction so two concurrent
    // demotions cannot both succeed.
    const result = await prisma.$transaction(
      async (tx) => {
        if (updates.isSuperAdmin === false && user.isSuperAdmin) {
          if (user.email.toLowerCase() === session.user.email.toLowerCase()) {
            return { error: 'Cannot remove your own superadmin status', status: 400 };
          }
          const otherSuperAdmins = await tx.user.count({
            where: { isSuperAdmin: true, isActive: true, id: { not: user.id } },
          });
          if (otherSuperAdmins === 0) {
            return { error: 'Cannot remove the last superadmin', status: 409 };
          }
        }

        await tx.user.update({
          where: { id: user.id },
          data: updates,
        });
        return null;
      },
      { isolationLevel: 'Serializable' }
    );

    if (result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const response: { ok: boolean; password?: string } = { ok: true };
    if (plainPassword) {
      response.password = plainPassword;
    }

    return NextResponse.json(response);
  } catch (error) {
    if ((error as { code?: string }).code === 'P2034') {
      return NextResponse.json(
        { error: 'Concurrent update detected, please retry' },
        { status: 409 }
      );
    }
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/users/[email] - Delete user
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is super-admin (DB-backed, not the JWT claim)
    if (session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const guard = await verifySuperAdmin(session.user.email);
    if (!guard.authorized) return guard.response!;

    const { email } = await params;

    // Find user
    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prevent self-delete
    if (user.email.toLowerCase() === session.user.email?.toLowerCase()) {
      return NextResponse.json(
        { error: 'Cannot delete yourself' },
        { status: 400 }
      );
    }

    // Guards + delete in a single serializable transaction:
    //  - do not orphan a project by deleting its only owner
    //  - do not delete the last active superadmin
    const result = await prisma.$transaction(
      async (tx) => {
        const ownedMemberships = await tx.projectMember.findMany({
          where: { userEmail: user.email, role: 'owner' },
          select: { projectId: true, project: { select: { name: true } } },
        });

        if (ownedMemberships.length > 0) {
          // Single grouped query instead of one count per project
          const otherOwners = await tx.projectMember.groupBy({
            by: ['projectId'],
            where: {
              projectId: { in: ownedMemberships.map((m) => m.projectId) },
              role: 'owner',
              userEmail: { not: user.email },
            },
            _count: { _all: true },
          });
          const withOtherOwner = new Set(otherOwners.map((o) => o.projectId));
          const orphaned = ownedMemberships.filter((m) => !withOtherOwner.has(m.projectId));
          if (orphaned.length > 0) {
            return {
              error: `Cannot delete the only owner of: ${orphaned.map((m) => m.project.name).join(', ')}. Transfer ownership first.`,
              status: 409,
            };
          }
        }

        if (user.isSuperAdmin) {
          const otherSuperAdmins = await tx.user.count({
            where: { isSuperAdmin: true, isActive: true, id: { not: user.id } },
          });
          if (otherSuperAdmins === 0) {
            return { error: 'Cannot delete the last superadmin', status: 409 };
          }
        }

        // Delete user's project memberships (cascade handles this, but explicit for clarity)
        await tx.projectMember.deleteMany({ where: { userEmail: user.email } });
        // Telegram links/codes are removed with the user (explicit for clarity)
        await tx.telegramLink.deleteMany({ where: { userEmail: user.email } });
        await tx.telegramLinkCode.deleteMany({ where: { userEmail: user.email } });
        await tx.user.delete({ where: { id: user.id } });
        return null;
      },
      { isolationLevel: 'Serializable' }
    );

    if (result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2034') {
      return NextResponse.json(
        { error: 'Concurrent update detected, please retry' },
        { status: 409 }
      );
    }
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
