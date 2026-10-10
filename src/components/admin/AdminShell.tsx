'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import AdminSidebar from './AdminSidebar';
import AdminHeader, { type AdminUserInfo } from './AdminHeader';

type AdminShellProps = {
  user: AdminUserInfo;
  children: React.ReactNode;
};

/**
 * Shell cliente del admin: comparte estado open entre header (hamburguesa)
 * y drawer móvil. El layout servidor solo valida auth/rol y pasa user.
 */
export default function AdminShell({ user, children }: AdminShellProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const prevPathRef = useRef(pathname);

  // Cerrar drawer al cambiar de ruta
  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      prevPathRef.current = pathname;
      setOpen(false);
    }
  }, [pathname]);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  return (
    <div className="min-h-screen bg-muted/30 flex">
      {/* Sidebar desktop (lg+) */}
      <AdminSidebar variant="desktop" />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader
          user={user}
          menuOpen={open}
          onMenuToggle={() => setOpen((v) => !v)}
        />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
          {children}
        </main>
      </div>

      {/* Drawer móvil via Radix Dialog (foco, Esc, overlay, scroll lock) */}
      <Dialog.Root open={open} onOpenChange={handleOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 lg:hidden" />
          <Dialog.Content
            id="admin-mobile-nav"
            className="fixed inset-y-0 left-0 z-50 w-[min(100vw-3rem,18rem)] max-w-full bg-charcoal-700 shadow-2xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left duration-200 lg:hidden flex flex-col"
            aria-label="Menú de navegación admin"
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              // Retorno de foco al botón hamburguesa si sigue en DOM
              const btn = document.querySelector<HTMLButtonElement>(
                'button[aria-controls="admin-mobile-nav"]'
              );
              btn?.focus();
            }}
          >
            <Dialog.Title className="sr-only">Navegación del panel admin</Dialog.Title>
            <Dialog.Description className="sr-only">
              Enlaces a las secciones del panel de administración
            </Dialog.Description>

            <div className="absolute top-3 right-3 z-10">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="flex items-center justify-center min-w-[44px] min-h-[44px] p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Cerrar menú"
                >
                  <X className="w-5 h-5" />
                </button>
              </Dialog.Close>
            </div>

            <AdminSidebar variant="drawer" onNavigate={close} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
