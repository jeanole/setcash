import { NextResponse } from 'next/server';
import { db as prisma } from '@/lib/db';

// Avoid any caching of the health check response.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch (error) {
    console.error('Error checking health:', error);
    return NextResponse.json({ status: 'error' }, { status: 503 });
  }
}
