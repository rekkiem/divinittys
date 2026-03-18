import { prisma } from '@/lib/prisma';
import CategoriasClient from './CategoriasClient';

async function getData() {
  return prisma.category.findMany({
    orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }],
    include: { _count: { select: { products: true } } },
  });
}

export default async function CategoriasPage() {
  const categories = await getData();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium text-charcoal-700">Categorías</h1>
          <p className="font-sans text-muted-foreground mt-1">{categories.length} categorías</p>
        </div>
      </div>
      <CategoriasClient categories={categories as any} />
    </div>
  );
}
