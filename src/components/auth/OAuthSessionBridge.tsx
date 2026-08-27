'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';
import toast from 'react-hot-toast';

/**
 * Si Auth.js tiene sesión (login Google OK) pero Zustand aún no tiene user,
 * llama a /api/oauth/exchange para emitir las cookies JWT de la app.
 */
export default function OAuthSessionBridge() {
  const { data: session, status } = useSession();
  const { user, setUser, setToken } = useAuthStore();
  const router = useRouter();
  const once = useRef(false);

  useEffect(() => {
    if (once.current) return;
    if (status !== 'authenticated' || !session?.user?.email) return;
    if (user) return; // ya hay sesión propia

    once.current = true;

    (async () => {
      try {
        const res = await fetch('/api/oauth/exchange', {
          method: 'POST',
          credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          console.error('[OAuthSessionBridge]', data);
          return;
        }
        setUser(data.data.user);
        setToken(data.data.accessToken);
        toast.success('¡Sesión iniciada con Google!');
        const role = data.data.user?.role;
        if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
          router.push('/admin');
        } else if (typeof window !== 'undefined' && window.location.pathname.includes('/login')) {
          router.push('/cuenta');
        } else {
          router.refresh();
        }
      } catch (e) {
        console.error('[OAuthSessionBridge]', e);
        once.current = false;
      }
    })();
  }, [status, session, user, setUser, setToken, router]);

  return null;
}
