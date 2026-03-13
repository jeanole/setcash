// ============================================================================
// Self-service password change API - PATCH (change password)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

// Validation schema for password change
const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z
    .string()
    .min(8)
    .max(128)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
      message:
        'Password must contain at least one uppercase letter, one lowercase letter, and one digit',
    }),
});

// PATCH /api/users/me/password - Change current user's password
export async function PATCH(req: NextRequest) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    const validation = ChangePasswordSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = validation.data;

    // Fetch the user's current password hash from DB
    const user = await db.user.findUnique({
      where: { id: sessionUser.id },
      select: { passwordHash: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify current password
    const passwordMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!passwordMatch) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 401 }
      );
    }

    // Hash new password with 12 rounds to match existing pattern
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    // Update password hash in DB
    await db.user.update({
      where: { id: sessionUser.id },
      data: { passwordHash: newPasswordHash },
    });

    return NextResponse.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
