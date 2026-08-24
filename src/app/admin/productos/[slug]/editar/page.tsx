import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import ProductForm from '@/components/admin/ProductForm';

async function getData(slug: string) {
  const [product, categories, brands] = await Promise.all([
    prisma.product.findUnique({
      where: { slug },
      include: {
        inventory: true,
        images: { orderBy: { sortOrder: 'asc' } },
        variants: { orderBy: { name: 'asc' } },
      },
    }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true },
    }),
    prisma.brand.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true },
    }),
  ]);
  return { product, categories, brands };
}

export default async function EditarProductoPage({ params }: { params: { slug: string } }) {
  const { product, categories, brands } = await getData(params.slug);
  if (!product) notFound();

  const initialData = {
    id: product.id,
    sku: product.sku,
    name: product.name,
    slug: product.slug,
    description: product.description,
    shortDescription: product.shortDescription,
    categoryId: product.categoryId,
    brandId: product.brandId,
    basePrice: Number(product.basePrice),
    comparePrice: product.comparePrice ? Number(product.comparePrice) : null,
    costPrice: product.costPrice ? Number(product.costPrice) : null,
    isActive: product.isActive,
    isFeatured: product.isFeatured,
    isOnSale: product.isOnSale,
    tags: product.tags,
    weight: product.weight ? Number(product.weight) : null,
    inventory: product.inventory
      ? {
          stock: product.inventory.stock,
          lowStockThreshold: product.inventory.lowStockThreshold,
          trackStock: product.inventory.trackStock,
        }
      : null,
    images: product.images.map((img) => ({
      url: img.url,
      isMain: img.isMain,
      id: img.id,
    })),
    variants: product.variants.map((v) => ({
      id: v.id,
      name: v.name,
      sku: v.sku,
      price: Number(v.price),
      stock: v.stock,
      isActive: v.isActive,
    })),
  };

  return (
    <div className="space-y-6">
      <ProductForm categories={categories} brands={brands} initialData={initialData} />
    </div>
  );
}
