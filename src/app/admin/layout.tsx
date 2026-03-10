import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/auth';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminHeader from '@/components/admin/AdminHeader';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies();
  const token = cookieStore.get('access_token')?.value;

  if (!token) redirect('/cuenta/login?redirect=/admin');

  const payload = await verifyAccessToken(token);
  if (!payload || !['ADMIN', 'SUPER_ADMIN'].includes(payload.role)) {
    redirect('/');
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
