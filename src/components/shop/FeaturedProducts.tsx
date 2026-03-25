'use client';

import ProductCard from './ProductCard';
import { motion } from 'framer-motion';

type PriceLike = number | string | { toString: () => string };

type Product = {
  id: string;
  name: string;
  slug: string;
  basePrice: PriceLike;
  comparePrice?: PriceLike | null;
  isOnSale?: boolean;
  isFeatured?: boolean;
  images: { url: string; alt?: string | null }[];
  brand?: { name: string } | null;
  inventory?: { stock: number } | null;
  category?: { name: string; slug: string } | null;
};

export default function FeaturedProducts({
  products,
  title = 'Productos Destacados',
}: {
  products: Product[];
  title?: string;
}) {
  if (!products.length) return null;

  return (
    <section className="py-20 px-4 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-12"
      >
        <p className="font-sans text-primary-500 text-xs font-semibold tracking-widest uppercase mb-3">
          Selección especial
        </p>
        <h2 className="section-title">{title}</h2>
      </motion.div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
        {products.map((product, i) => (
          <ProductCard key={product.id} product={product} index={i} />
        ))}
      </div>
    </section>
  );
}
