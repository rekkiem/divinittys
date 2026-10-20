import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  Tag,
  Percent,
  BarChart3,
  Upload,
  Settings,
} from 'lucide-react';

export type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
};

/** Ítems de navegación del panel admin (única fuente de verdad). */
export const adminNavItems: AdminNavItem[] = [
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

export function isAdminNavActive(pathname: string, item: AdminNavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname.startsWith(item.href);
}
