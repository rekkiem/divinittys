'use client';

import { useEffect, useState } from 'react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ProductCard from '@/components/shop/ProductCard';
import { useWishlistStore } from '@/hooks/useWishlist';
import { Heart, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

type Product = {
  id: string;
  name: string;
  slug: string;
  basePrice: number;
  comparePrice?: number | null;
  isOnSale?: boolean;
  isFeatured?: boolean;
  images: { url: string }[];
  brand?: { name: string } | null;
  inventory?: { stock: number } | null;
};

export default function WishlistPage() {
  const { productIds: wishlistIds } = useWishlistStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (wishlistIds.length === 0) {
      setProducts([]);
      return;
    }
    setLoading(true);
    fetch(`/api/products?ids=${wishlistIds.join(',')}`)
      .then((r) => r.json())
      .then((data) => setProducts(data.data?.products || []))
      .finally(() => setLoading(false));
  }, [wishlistIds]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex items-center gap-3 mb-10">
          <Heart className="w-6 h-6 text-primary-500 fill-primary-500" />
          <h1 className="section-title">Mi Lista de Deseos</h1>
          {wishlistIds.length > 0 && (
            <span className="ml-2 font-sans text-sm text-charcoal-400">({wishlistIds.length} productos)</span>
          )}
        </div>

        {wishlistIds.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
            <Heart className="w-16 h-16 text-champagne-300 mx-auto mb-4" />
            <p className="font-display text-3xl font-light text-charcoal-400 mb-4">Tu lista de deseos está vacía</p>
            <p className="font-sans text-charcoal-400 mb-8">Guarda tus productos favoritos para comprarlos después</p>
            <Link href="/productos" className="btn-primary">
              Explorar productos
            </Link>
          </motion.div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="aspect-square shimmer rounded-2xl" />
                ))
              : products.map((product, i) => (
                  <ProductCard key={product.id} product={product} index={i} />
                ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
