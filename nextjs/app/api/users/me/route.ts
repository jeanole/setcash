// ============================================================================
// Self-service user profile API - GET (fetch profile), PATCH (update profile)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { z } from 'zod';

// Validation schema for profile updates
const UpdateProfileSchema = z.object({
  username: z.string().max(50).nullable().optional(),
  firstName: z.string().max(100).nullable().optional(),
  lastName: z.string().max(100).nullable().optional(),
  mobile: z.string().max(30).nullable().optional(),
});

// GET /api/users/me - Fetch current user's profile fields
export async function GET() {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        mobile: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/users/me - Update current user's profile fields
export async function PATCH(req: NextRequest) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    const validation = UpdateProfileSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { username, firstName, lastName, mobile } = validation.data;

    // Check username uniqueness case-insensitively (exclude current user)
    if (username != null) {
      const existing = await db.user.findFirst({
        where: {
          username: {
            equals: username,
            mode: 'insensitive',
          },
          id: {
            not: sessionUser.id,
          },
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: 'Username is already taken' },
          { status: 409 }
        );
      }
    }

    const updatedUser = await db.user.update({
      where: { id: sessionUser.id },
      data: {
        ...(username !== undefined && { username }),
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(mobile !== undefined && { mobile }),
      },
      select: {
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        mobile: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Error updating user profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
