'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';
import toast from 'react-hot-toast';

/**
 * Si Auth.js tiene sesión (Google OK) y Zustand no tiene user,
 * POST /api/oauth/exchange → cookies JWT + store.
 */
export default function OAuthSessionBridge() {
  const { data: session, status } = useSession();
  const { user, setUser, setToken } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const once = useRef(false);

  useEffect(() => {
    if (once.current) return;
    if (status !== 'authenticated' || !session?.user?.email) return;
    if (user) return;

    once.current = true;

    (async () => {
      try {
        const res = await fetch('/api/oauth/exchange', {
          method: 'POST',
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data.success) {
          console.error('[OAuthSessionBridge] exchange failed', res.status, data);
          once.current = false;
          return;
        }

        setUser(data.data.user);
        setToken(data.data.accessToken);
        toast.success('¡Sesión iniciada con Google!');

        const role = data.data.user?.role;
        if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
          router.replace('/admin');
        } else if (pathname?.includes('/login') || pathname?.includes('/registro')) {
          router.replace('/cuenta');
        } else {
          router.refresh();
        }
      } catch (e) {
        console.error('[OAuthSessionBridge]', e);
        once.current = false;
      }
    })();
  }, [status, session, user, setUser, setToken, router, pathname]);

  return null;
}
