/**
 * POST /api/admin/fix-seed
 * Emergency endpoint: resets admin user role to SUPER_ADMIN.
 * Only works in development. Use when seed ran but role wasn't updated.
 * 
 * Usage: curl -X POST http://localhost:3000/api/admin/fix-seed
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }

  try {
    const updated = await prisma.user.updateMany({
      where: { email: 'admin@divinittys.cl' },
      data: { role: 'SUPER_ADMIN', isActive: true },
    });

    if (updated.count === 0) {
      return NextResponse.json({
        error: 'Admin user not found',
        hint: 'Run: docker compose down -v && docker compose up --build',
      }, { status: 404 });
    }

    const user = await prisma.user.findFirst({
      where: { email: 'admin@divinittys.cl' },
      select: { id: true, email: true, role: true, isActive: true },
    });

    return NextResponse.json({
      success: true,
      message: '✅ Admin role fixed. Log out and log in again to get a new token.',
      user,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
