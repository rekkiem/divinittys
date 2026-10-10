'use client';

import { Menu } from 'lucide-react';

export type AdminUserInfo = {
  name: string | null;
  email: string;
  avatar: string | null;
};

type AdminHeaderProps = {
  user: AdminUserInfo;
  menuOpen: boolean;
  onMenuToggle: () => void;
};

function getInitial(user: AdminUserInfo): string {
  const source = (user.name?.trim() || user.email || 'A').trim();
  return source.charAt(0).toUpperCase();
}

export default function AdminHeader({ user, menuOpen, onMenuToggle }: AdminHeaderProps) {
  const initial = getInitial(user);
  const displayName = user.name?.trim() || user.email;

  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 sm:px-6 sticky top-0 z-10">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          className="lg:hidden flex items-center justify-center min-w-[44px] min-h-[44px] p-2 rounded-lg hover:bg-muted text-muted-foreground"
          onClick={onMenuToggle}
          aria-label={menuOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'}
          aria-expanded={menuOpen}
          aria-controls="admin-mobile-nav"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <p className="font-sans text-xs text-muted-foreground truncate">Panel Administrativo</p>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Campana sin función real: omitida a propósito */}
        <div
          className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-rose-400 flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden"
          title={displayName}
          aria-label={`Usuario: ${displayName}`}
        >
          {user.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar} alt="" className="w-full h-full object-cover" />
          ) : (
            initial
          )}
        </div>
      </div>
    </header>
  );
}
