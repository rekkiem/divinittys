import { prisma } from '@/lib/prisma';
import ProductForm from '@/components/admin/ProductForm';

async function getData() {
  const [categories, brands] = await Promise.all([
    prisma.category.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, slug: true } }),
    prisma.brand.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, slug: true } }),
  ]);
  return { categories, brands };
}

export default async function NuevoProductoPage() {
  const { categories, brands } = await getData();
  return (
    <div className="space-y-6">
      <ProductForm categories={categories} brands={brands} />
    </div>
  );
}
