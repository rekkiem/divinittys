'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, ChevronRight } from 'lucide-react';
import { adminNavItems, isAdminNavActive } from './admin-nav';

type AdminSidebarProps = {
  /** Callback al hacer click en un ítem (cierra drawer móvil). */
  onNavigate?: () => void;
  /** Variante embebida en drawer (sin aside fixed). */
  variant?: 'desktop' | 'drawer';
};

export default function AdminSidebar({ onNavigate, variant = 'desktop' }: AdminSidebarProps) {
  const pathname = usePathname() ?? '';

  const nav = (
    <>
      {/* Logo */}
      <Link
        href="/admin"
        onClick={onNavigate}
        className="flex items-center gap-3 p-6 border-b border-white/10"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-rose-400 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="font-display text-white text-lg font-light tracking-widest">DIVINITTYS</p>
          <p className="font-sans text-xs text-white/40 tracking-wide">Panel Admin</p>
        </div>
      </Link>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto" aria-label="Navegación admin">
        {adminNavItems.map((item) => {
          const active = isAdminNavActive(pathname, item);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-3 min-h-[44px] py-2.5 rounded-xl transition-all duration-150 group ${
                active
                  ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <item.icon className={`w-4.5 h-4.5 flex-shrink-0 ${active ? 'text-primary-400' : ''}`} />
              <span className="font-sans font-medium text-sm">{item.label}</span>
              {active && <ChevronRight className="w-3.5 h-3.5 ml-auto text-primary-400" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/10">
        <Link
          href="/"
          className="flex items-center gap-2 px-3 min-h-[44px] py-2 rounded-lg text-white/40 hover:text-white/60 transition-colors font-sans text-xs"
          target="_blank"
          onClick={onNavigate}
        >
          <span>← Ver tienda</span>
        </Link>
      </div>
    </>
  );

  if (variant === 'drawer') {
    return <div className="flex flex-col h-full bg-charcoal-700">{nav}</div>;
  }

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-charcoal-700 min-h-screen">
      {nav}
    </aside>
  );
}
