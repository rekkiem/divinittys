'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Heart, ShoppingBag, Star, Eye } from 'lucide-react';
import { motion } from 'framer-motion';
import { useCartStore } from '@/hooks/useCart';
import { useWishlistStore } from '@/hooks/useWishlist';
import { formatCLP, calculateDiscount } from '@/lib/utils/api';
import toast from 'react-hot-toast';

type ProductCardProps = {
  product: {
    id: string;
    name: string;
    slug: string;
    basePrice: number | string;
    comparePrice?: number | string | null;
    isOnSale?: boolean;
    isFeatured?: boolean;
    images: { url: string; alt?: string | null }[];
    brand?: { name: string } | null;
    inventory?: { stock: number } | null;
    category?: { name: string; slug: string } | null;
    vendor?: { storeName: string } | null;
  };
  index?: number;
};

export default function ProductCard({ product, index = 0 }: ProductCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const { addItem } = useCartStore();
  const { toggle, isInWishlist } = useWishlistStore();

  const price = Number(product.basePrice);
  const comparePrice = product.comparePrice ? Number(product.comparePrice) : null;
  const discount = comparePrice ? calculateDiscount(price, comparePrice) : 0;
  const inWishlist = isInWishlist(product.id);
  const inStock = !product.inventory || product.inventory.stock > 0;
  const imageUrl = product.images[0]?.url;

  const handleAddToCart = (e: React.MouseEvent) => {
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

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggle(product.id);
    toast.success(inWishlist ? 'Eliminado de favoritos' : 'Agregado a favoritos');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <Link href={`/productos/${product.slug}`}>
        <div className="card-product relative overflow-hidden">
          {/* Image */}
          <div className="relative aspect-square overflow-hidden bg-champagne-50">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={product.name}
                fill
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
            <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <button
                onClick={handleWishlist}
                className={`w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center transition-colors ${
                  inWishlist ? 'text-rose-500' : 'text-charcoal-400 hover:text-rose-500'
                }`}
              >
                <Heart className={`w-4 h-4 ${inWishlist ? 'fill-current' : ''}`} />
              </button>
              <Link
                href={`/productos/${product.slug}`}
                onClick={(e) => e.stopPropagation()}
                className="w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center text-charcoal-400 hover:text-primary-500 transition-colors"
              >
                <Eye className="w-4 h-4" />
              </Link>
            </div>

            {/* Add to cart - hover */}
            <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-200">
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
            {product.vendor && (
              <p className="font-sans text-[11px] text-muted-foreground">Vendido por {product.vendor.storeName}</p>
            )}

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
      </Link>
    </motion.div>
  );
}
