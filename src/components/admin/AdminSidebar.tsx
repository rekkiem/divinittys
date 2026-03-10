'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Package, ShoppingBag, Users, Tag,
  Percent, BarChart3, Upload, Settings, Sparkles, ChevronRight,
} from 'lucide-react';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/productos', label: 'Productos', icon: Package },
  { href: '/admin/pedidos', label: 'Pedidos', icon: ShoppingBag },
  { href: '/admin/clientes', label: 'Clientes', icon: Users },
  { href: '/admin/categorias', label: 'Categorías', icon: Tag },
  { href: '/admin/ofertas', label: 'Ofertas / Cupones', icon: Percent },
  { href: '/admin/stock', label: 'Stock', icon: BarChart3 },
  { href: '/admin/importar', label: 'Importar Excel', icon: Upload },
  { href: '/admin/configuracion', label: 'Configuración', icon: Settings },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-charcoal-700 min-h-screen">
      {/* Logo */}
      <Link href="/admin" className="flex items-center gap-3 p-6 border-b border-white/10">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-rose-400 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="font-display text-white text-lg font-light tracking-widest">DIVINITTYS</p>
          <p className="font-sans text-xs text-white/40 tracking-wide">Panel Admin</p>
        </div>
      </Link>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group ${
                isActive
                  ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <item.icon className={`w-4.5 h-4.5 flex-shrink-0 ${isActive ? 'text-primary-400' : ''}`} />
              <span className="font-sans font-medium text-sm">{item.label}</span>
              {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto text-primary-400" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/10">
        <Link
          href="/"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-white/40 hover:text-white/60 transition-colors font-sans text-xs"
          target="_blank"
        >
          <span>← Ver tienda</span>
        </Link>
      </div>
    </aside>
  );
}
