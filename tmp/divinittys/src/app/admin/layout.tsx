import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/auth';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminHeader from '@/components/admin/AdminHeader';

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

  return (
    <div className="min-h-screen bg-muted/30 flex">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader />
        <main className="flex-1 p-6 lg:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
