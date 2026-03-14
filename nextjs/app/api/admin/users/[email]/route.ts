// ============================================================================
// Admin User API - PUT (update/toggle admin/reset password), DELETE
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { randomBytes } from 'crypto';

// Validation schema for the resetPassword path
const ResetPasswordSchema = z.object({
  resetPassword: z.literal(true),
  isSuperAdmin: z.boolean().optional(),
});

// Validation schema for updating users
const UpdateUserSchema = z
  .object({
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
    (data) => data.password !== undefined || data.isSuperAdmin !== undefined,
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

    // Check if user is super-admin
    if (session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { email } = await params;
    const body = await req.json();

    // Find user
    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Handle password reset (generate random password if requested)
    let plainPassword: string | undefined;
    const updates: { passwordHash?: string; isSuperAdmin?: boolean } = {};

    if (body.resetPassword === true) {
      // Validate the resetPassword path with Zod
      const resetValidation = ResetPasswordSchema.safeParse(body);
      if (!resetValidation.success) {
        return NextResponse.json(
          { error: resetValidation.error.issues[0].message },
          { status: 400 }
        );
      }
      // Generate random 12-char password (9 bytes → 12 base64url chars, URL-safe alphabet)
      plainPassword = randomBytes(9).toString('base64url').slice(0, 12);
      updates.passwordHash = await bcrypt.hash(plainPassword, 12);
      if (resetValidation.data.isSuperAdmin !== undefined) {
        updates.isSuperAdmin = resetValidation.data.isSuperAdmin;
      }
    } else if (body.password) {
      // Validate custom password
      const validation = UpdateUserSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: validation.error.issues[0].message },
          { status: 400 }
        );
      }
      updates.passwordHash = await bcrypt.hash(body.password, 12);
    }

    if (body.isSuperAdmin !== undefined) {
      updates.isSuperAdmin = body.isSuperAdmin;
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

    // Update user
    await prisma.user.update({
      where: { id: user.id },
      data: updates,
    });

    const response: { ok: boolean; password?: string } = { ok: true };
    if (plainPassword) {
      response.password = plainPassword;
    }

    return NextResponse.json(response);
  } catch (error) {
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

    // Check if user is super-admin
    if (session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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

    // Delete memberships and user in a single transaction
    await prisma.$transaction([
      // Delete user's project memberships (cascade handles this, but explicit for clarity)
      prisma.projectMember.deleteMany({ where: { userEmail: user.email } }),
      // Delete user
      prisma.user.delete({ where: { id: user.id } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
