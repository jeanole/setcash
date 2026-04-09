import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { tourCompleteLimiter } from '@/lib/ratelimit';

export async function POST() {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit by user email
    const { success } = await tourCompleteLimiter.limit(sessionUser.email);
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    await db.user.update({
      where: { id: sessionUser.id },
      data: { hasSeenTour: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error completing tour:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
