import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import AdminShell from '@/components/admin/AdminShell';

export const dynamic = 'force-dynamic';

/** Admin: noindex + nofollow. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies();
  const token = cookieStore.get('access_token')?.value;

  // FIX: No token → go to login with redirect param
  // Note: we encode the redirect URL to avoid issues with special chars
  if (!token) {
    redirect('/cuenta/login?redirect=%2Fadmin');
  }

  const payload = await verifyAccessToken(token);

  // FIX: Invalid/expired token → clear hint and redirect to login
  // (don't redirect to '/' which could cause loops via Navbar auth checks)
  if (!payload) {
    redirect('/cuenta/login?redirect=%2Fadmin&reason=expired');
  }

  // FIX: Authenticated but not admin → go to customer account, not '/'
  if (!['ADMIN', 'SUPER_ADMIN'].includes(payload.role)) {
    redirect('/cuenta');
  }

  // Datos de usuario para header (inicial / nombre / avatar). No cambia auth.
  const dbUser = await prisma.user.findFirst({
    where: { id: payload.userId, isActive: true },
    select: { name: true, email: true, avatar: true },
  });

  const user = {
    name: dbUser?.name ?? null,
    email: dbUser?.email ?? payload.email,
    avatar: dbUser?.avatar ?? null,
  };

  return <AdminShell user={user}>{children}</AdminShell>;
}
