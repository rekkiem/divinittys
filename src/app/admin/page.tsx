import { prisma } from '@/lib/prisma';
import { formatCLP } from '@/lib/utils/api';
import { ShoppingBag, Users, Package, TrendingUp, AlertCircle } from 'lucide-react';

async function getDashboardStats() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  const [
    totalOrders,
    ordersThisMonth,
    ordersLastMonth,
    totalRevenue,
    revenueThisMonth,
    totalCustomers,
    newCustomers,
    pendingOrders,
    lowStockProducts,
    recentOrders,
  ] = await Promise.all([
    prisma.order.count({ where: { paymentStatus: 'PAID' } }),
    prisma.order.count({ where: { paymentStatus: 'PAID', createdAt: { gte: startOfMonth } } }),
    prisma.order.count({ where: { paymentStatus: 'PAID', createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } } }),
    prisma.order.aggregate({ where: { paymentStatus: 'PAID' }, _sum: { total: true } }),
    prisma.order.aggregate({ where: { paymentStatus: 'PAID', createdAt: { gte: startOfMonth } }, _sum: { total: true } }),
    prisma.user.count({ where: { role: 'CUSTOMER' } }),
    prisma.user.count({ where: { role: 'CUSTOMER', createdAt: { gte: startOfMonth } } }),
    prisma.order.count({ where: { status: 'PENDING' } }),
    prisma.inventory.findMany({
      where: { stock: { lte: 5 }, trackStock: true },
      include: { product: { select: { name: true, sku: true } } },
      take: 5,
    }),
    prisma.order.findMany({
      where: { paymentStatus: 'PAID' },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { items: { take: 1 } },
    }),
  ]);

  return {
    totalOrders, ordersThisMonth, ordersLastMonth,
    totalRevenue: Number(totalRevenue._sum.total) || 0,
    revenueThisMonth: Number(revenueThisMonth._sum.total) || 0,
    totalCustomers, newCustomers, pendingOrders,
    lowStockProducts, recentOrders,
  };
}

export default async function AdminDashboard() {
  const stats = await getDashboardStats();

  const orderGrowth = stats.ordersLastMonth > 0
    ? ((stats.ordersThisMonth - stats.ordersLastMonth) / stats.ordersLastMonth * 100).toFixed(1)
    : '0';

  const cards = [
    {
      title: 'Ingresos del Mes',
      value: formatCLP(stats.revenueThisMonth),
      icon: TrendingUp,
      change: `${formatCLP(stats.totalRevenue)} total`,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      title: 'Pedidos del Mes',
      value: stats.ordersThisMonth.toString(),
      icon: ShoppingBag,
      change: `${orderGrowth}% vs mes anterior`,
      color: 'text-primary-600',
      bg: 'bg-primary-50',
    },
    {
      title: 'Clientes Totales',
      value: stats.totalCustomers.toString(),
      icon: Users,
      change: `+${stats.newCustomers} nuevos este mes`,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      title: 'Pedidos Pendientes',
      value: stats.pendingOrders.toString(),
      icon: Package,
      change: 'Requieren atención',
      color: stats.pendingOrders > 0 ? 'text-amber-600' : 'text-charcoal-400',
      bg: stats.pendingOrders > 0 ? 'bg-amber-50' : 'bg-muted',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-medium text-charcoal-700">Dashboard</h1>
        <p className="font-sans text-muted-foreground mt-1">Resumen del negocio</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.title} className="bg-card rounded-2xl border border-border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-sans text-sm text-muted-foreground font-medium">{card.title}</p>
              <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
            </div>
            <div>
              <p className="font-display text-3xl font-light text-charcoal-800">{card.value}</p>
              <p className="font-sans text-xs text-muted-foreground mt-1">{card.change}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent orders */}
        <div className="lg:col-span-2 bg-card rounded-2xl border border-border">
          <div className="p-6 border-b border-border">
            <h2 className="font-sans font-semibold text-charcoal-700">Pedidos Recientes</h2>
          </div>
          <div className="divide-y divide-border">
            {stats.recentOrders.length === 0 ? (
              <p className="p-6 text-center font-sans text-muted-foreground text-sm">No hay pedidos aún</p>
            ) : stats.recentOrders.map((order: any) => (
              <div key={order.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                <div>
                  <p className="font-sans font-medium text-sm text-charcoal-700">{order.orderNumber}</p>
                  <p className="font-sans text-xs text-muted-foreground">
                    {new Date(order.createdAt).toLocaleDateString('es-CL')} · {order.items.length} productos
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-sans font-bold text-sm text-primary-600">{formatCLP(Number(order.total))}</p>
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                    order.status === 'DELIVERED' ? 'bg-emerald-100 text-emerald-700' :
                    order.status === 'SHIPPED' ? 'bg-blue-100 text-blue-700' :
                    order.status === 'CONFIRMED' ? 'bg-primary-100 text-primary-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Low stock alert */}
        <div className="bg-card rounded-2xl border border-border">
          <div className="p-6 border-b border-border flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <h2 className="font-sans font-semibold text-charcoal-700">Stock Bajo</h2>
          </div>
          <div className="divide-y divide-border">
            {stats.lowStockProducts.length === 0 ? (
              <p className="p-6 text-center font-sans text-sm text-emerald-600">✓ Todo en orden</p>
            ) : stats.lowStockProducts.map((inv: any) => (
              <div key={inv.id} className="p-4">
                <p className="font-sans text-sm font-medium text-charcoal-700 line-clamp-1">{inv.product.name}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="font-sans text-xs text-muted-foreground">SKU: {inv.product.sku}</p>
                  <span className={`text-xs font-bold ${inv.stock === 0 ? 'text-red-500' : 'text-amber-500'}`}>
                    {inv.stock} unid.
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
