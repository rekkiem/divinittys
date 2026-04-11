'use client';

import { MouseEvent, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart, ShoppingBag, Eye } from 'lucide-react';
import { motion } from 'framer-motion';
import { useCartStore } from '@/hooks/useCart';
import { useWishlistStore } from '@/hooks/useWishlist';
import { formatCLP, calculateDiscount } from '@/lib/utils/api';
import toast from 'react-hot-toast';

type PriceLike = number | string | { toString: () => string };

type ProductCardProps = {
  product: {
    id: string;
    name: string;
    slug: string;
    basePrice: PriceLike;
    comparePrice?: PriceLike | null;
    isOnSale?: boolean;
    isFeatured?: boolean;
    images: { url: string; alt?: string | null }[];
    imageUrl?: string | null;
    brand?: { name: string } | null;
    inventory?: { stock: number } | null;
    category?: { name: string; slug: string } | null;
  };
  index?: number;
};

export default function ProductCard({ product, index = 0 }: ProductCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const router = useRouter();
  const { addItem } = useCartStore();
  const { toggle, isInWishlist } = useWishlistStore();

  const price = Number(product.basePrice);
  const comparePrice = product.comparePrice ? Number(product.comparePrice) : null;
  const discount = comparePrice ? calculateDiscount(price, comparePrice) : 0;
  const inWishlist = hydrated ? isInWishlist(product.id) : false;
  const inStock = !product.inventory || product.inventory.stock > 0;
  const imageUrl = product.images?.[0]?.url || product.imageUrl || '/placeholder-product.svg';

  useEffect(() => {
    setHydrated(true);
  }, []);

  const handleAddToCart = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!inStock) return;

    addItem({
      id: product.id,
      name: product.name,
      price,
      image: imageUrl,
      slug: product.slug,
    });
    toast.success(`${product.name} agregado al carrito`);
  };

  const handleWishlist = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    toggle(product.id);
    toast.success(inWishlist ? 'Eliminado de favoritos' : 'Agregado a favoritos');
  };

  const openDetails = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/productos/${product.slug}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <div className="group card-product relative overflow-hidden">
        <Link href={`/productos/${product.slug}`} className="absolute inset-0 z-10" aria-label={`Ver ${product.name}`} />
        <div className="relative z-0">
          {/* Image */}
          <div className="relative aspect-square overflow-hidden bg-champagne-50">
            {imageUrl && imageUrl !== '/placeholder-product.svg' ? (
              <Image
                src={imageUrl}
                alt={product.name}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className={`object-cover transition-all duration-500 group-hover:scale-105 ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                onLoad={() => setImageLoaded(true)}
              />
            ) : (
              <div className="absolute inset-0 bg-champagne-gradient flex items-center justify-center">
                <span className="font-display text-6xl text-white/30 font-light">D</span>
              </div>
            )}

            {!imageLoaded && imageUrl && (
              <div className="absolute inset-0 shimmer" />
            )}

            {/* Badges */}
            <div className="absolute top-3 left-3 flex flex-col gap-1.5">
              {product.isOnSale && discount > 0 && (
                <span className="badge-sale">-{discount}%</span>
              )}
              {product.isFeatured && !product.isOnSale && (
                <span className="badge-featured">✦ Destacado</span>
              )}
              {!inStock && (
                <span className="badge bg-charcoal-500 text-white">Agotado</span>
              )}
            </div>

            {/* Actions overlay */}
            <div className="absolute top-3 right-3 z-20 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <button
                onClick={handleWishlist}
                className={`w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center transition-colors ${
                  inWishlist ? 'text-rose-500' : 'text-charcoal-400 hover:text-rose-500'
                }`}
              >
                <Heart className={`w-4 h-4 ${inWishlist ? 'fill-current' : ''}`} />
              </button>
              <button
                onClick={openDetails}
                className="w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center text-charcoal-400 hover:text-primary-500 transition-colors"
                aria-label={`Abrir ${product.name}`}
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>

            {/* Add to cart - hover */}
            <div className="absolute bottom-0 left-0 right-0 z-20 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-200">
              <button
                onClick={handleAddToCart}
                disabled={!inStock}
                className="w-full py-2.5 px-4 rounded-xl bg-primary-500 hover:bg-primary-600 disabled:bg-charcoal-300 text-white font-sans font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <ShoppingBag className="w-4 h-4" />
                {inStock ? 'Agregar al carrito' : 'Sin stock'}
              </button>
            </div>
          </div>

          {/* Info */}
          <div className="p-4 space-y-2">
            {product.brand && (
              <p className="font-sans text-xs font-semibold text-primary-500 tracking-wider uppercase">
                {product.brand.name}
              </p>
            )}

            <h3 className="font-sans text-sm font-medium text-charcoal-700 line-clamp-2 leading-tight group-hover:text-primary-600 transition-colors">
              {product.name}
            </h3>

            <div className="flex items-baseline gap-2">
              <span className="price-format text-lg">
                {formatCLP(price)}
              </span>
              {comparePrice && comparePrice > price && (
                <span className="price-compare text-sm">
                  {formatCLP(comparePrice)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
