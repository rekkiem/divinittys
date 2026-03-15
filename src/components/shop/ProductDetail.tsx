'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ShoppingBag, Heart, Share2, Star, ChevronRight, Minus, Plus, Truck, ShieldCheck, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { useCartStore } from '@/hooks/useCart';
import { useWishlistStore } from '@/hooks/useWishlist';
import { formatCLP, calculateDiscount } from '@/lib/utils/api';
import toast from 'react-hot-toast';

type Product = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  description?: string | null;
  shortDescription?: string | null;
  basePrice: number | string | { toString(): string };
  comparePrice?: number | string | { toString(): string } | null;
  isOnSale?: boolean;
  isFeatured?: boolean;
  images: { id: string; url: string; alt?: string | null; isMain: boolean }[];
  brand?: { id: string; name: string; slug: string } | null;
  category?: { id: string; name: string; slug: string; parent?: { name: string; slug: string } | null } | null;
  inventory?: { stock: number; allowBackorder: boolean } | null;
  attributes: { id: string; name: string; value: string }[];
  variants: { id: string; name: string; sku: string; price: number | string | { toString(): string }; stock: number; options?: any }[];
  reviews: { id: string; rating: number; title?: string | null; body?: string | null; user: { name?: string | null }; createdAt: Date }[];
};

const TRUST_BADGES = [
  { Icon: Truck, text: 'Despacho a todo Chile' },
  { Icon: ShieldCheck, text: 'Pago 100% seguro' },
  { Icon: RefreshCw, text: '30 días para devolver' },
];

export default function ProductDetail({ product }: { product: Product }) {
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(
    product.variants.length === 1 ? product.variants[0].id : null
  );
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'description' | 'attributes' | 'reviews'>('description');

  const { addItem } = useCartStore();
  const { toggle, isInWishlist } = useWishlistStore();

  const price = Number(product.basePrice);
  const comparePrice = product.comparePrice ? Number(product.comparePrice) : null;
  const discount = comparePrice ? calculateDiscount(price, comparePrice) : 0;
  const stock = product.inventory?.stock ?? 0;
  const inStock = stock > 0 || !!product.inventory?.allowBackorder;
  const inWishlist = isInWishlist(product.id);
  const avgRating = product.reviews.length
    ? product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length
    : 0;

  const handleAddToCart = () => {
    addItem({
      id: product.id,
      name: product.name,
      price,
      image: product.images.find((i) => i.isMain)?.url || product.images[0]?.url,
      slug: product.slug,
      quantity,
    });
    toast.success(`${product.name} agregado al carrito ✓`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs font-sans text-charcoal-400 mb-8">
        <Link href="/" className="hover:text-primary-500 transition-colors">Inicio</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/productos" className="hover:text-primary-500 transition-colors">Productos</Link>
        {product.category && (
          <>
            <ChevronRight className="w-3 h-3" />
            <Link href={`/productos?category=${product.category.slug}`} className="hover:text-primary-500 transition-colors">
              {product.category.name}
            </Link>
          </>
        )}
        <ChevronRight className="w-3 h-3" />
        <span className="text-charcoal-600 truncate max-w-[200px]">{product.name}</span>
      </nav>

      <div className="grid lg:grid-cols-2 gap-12 lg:gap-20">
        {/* Images */}
        <div className="space-y-4">
          <motion.div
            className="relative aspect-square rounded-3xl overflow-hidden bg-champagne-50"
            key={selectedImage}
            initial={{ opacity: 0.7 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {product.images[selectedImage]?.url ? (
              <Image
                src={product.images[selectedImage].url}
                alt={product.images[selectedImage].alt || product.name}
                fill
                className="object-cover"
                priority
              />
            ) : (
              <div className="absolute inset-0 bg-champagne-gradient flex items-center justify-center">
                <span className="font-display text-8xl text-white/30 font-light">D</span>
              </div>
            )}

            {discount > 0 && (
              <div className="absolute top-4 left-4 badge-sale text-base px-3 py-1.5">
                -{discount}%
              </div>
            )}
          </motion.div>

          {/* Thumbnails */}
          {product.images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {product.images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setSelectedImage(i)}
                  className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                    i === selectedImage ? 'border-primary-500' : 'border-transparent hover:border-primary-300'
                  }`}
                >
                  {img.url ? (
                    <Image src={img.url} alt="" width={64} height={64} className="object-cover w-full h-full" />
                  ) : (
                    <div className="w-full h-full bg-champagne-200" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="space-y-6">
          {/* Brand & SKU */}
          <div className="flex items-center justify-between">
            {product.brand && (
              <Link href={`/productos?brand=${product.brand.slug}`}>
                <span className="font-sans text-xs font-bold text-primary-500 tracking-widest uppercase hover:text-primary-600 transition-colors">
                  {product.brand.name}
                </span>
              </Link>
            )}
            <span className="font-sans text-xs text-charcoal-300">SKU: {product.sku}</span>
          </div>

          {/* Name */}
          <h1 className="font-display text-3xl lg:text-4xl font-light text-charcoal-700 leading-tight">
            {product.name}
          </h1>

          {/* Rating */}
          {product.reviews.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex">
                {[1,2,3,4,5].map((s) => (
                  <Star key={s} className={`w-4 h-4 ${s <= Math.round(avgRating) ? 'text-primary-400 fill-primary-400' : 'text-charcoal-200'}`} />
                ))}
              </div>
              <span className="font-sans text-sm text-charcoal-400">({product.reviews.length} reseñas)</span>
            </div>
          )}

          {/* Price */}
          <div className="flex items-baseline gap-4">
            <span className="font-sans font-bold text-4xl text-charcoal-700">{formatCLP(price)}</span>
            {comparePrice && comparePrice > price && (
              <span className="font-sans text-xl text-charcoal-300 line-through">{formatCLP(comparePrice)}</span>
            )}
            {discount > 0 && (
              <span className="badge-sale">Ahorras {formatCLP(comparePrice! - price)}</span>
            )}
          </div>

          {/* Short description */}
          {product.shortDescription && (
            <p className="font-sans text-charcoal-500 leading-relaxed">{product.shortDescription}</p>
          )}

          {/* Variants */}
          {product.variants.length > 1 && (
            <div>
              <p className="font-sans text-sm font-semibold text-charcoal-600 mb-3">Variante</p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariant(v.id)}
                    disabled={v.stock === 0}
                    className={`px-4 py-2 rounded-xl border text-sm font-sans font-medium transition-all ${
                      selectedVariant === v.id
                        ? 'bg-primary-500 border-primary-500 text-white'
                        : v.stock === 0
                        ? 'border-charcoal-200 text-charcoal-300 cursor-not-allowed opacity-50'
                        : 'border-champagne-300 text-charcoal-600 hover:border-primary-300'
                    }`}
                  >
                    {v.name}
                    {v.stock === 0 && ' (Agotado)'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stock */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${inStock ? 'bg-green-500' : 'bg-rose-500'}`} />
            <span className={`font-sans text-sm font-medium ${inStock ? 'text-green-600' : 'text-rose-500'}`}>
              {inStock ? (stock > 5 ? 'En stock' : `Últimas ${stock} unidades`) : 'Agotado'}
            </span>
          </div>

          {/* Quantity + Add to cart */}
          <div className="flex gap-3">
            <div className="flex items-center border border-champagne-300 rounded-xl overflow-hidden">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-10 h-12 flex items-center justify-center hover:bg-champagne-50 transition-colors text-charcoal-600"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-12 text-center font-sans font-semibold text-charcoal-700">{quantity}</span>
              <button
                onClick={() => setQuantity(Math.min(stock || 99, quantity + 1))}
                className="w-10 h-12 flex items-center justify-center hover:bg-champagne-50 transition-colors text-charcoal-600"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handleAddToCart}
              disabled={!inStock}
              className="flex-1 btn-primary flex items-center justify-center gap-2 h-12 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ShoppingBag className="w-5 h-5" />
              {inStock ? 'Agregar al carrito' : 'Sin stock'}
            </button>

            <button
              onClick={() => { toggle(product.id); toast.success(inWishlist ? 'Eliminado de favoritos' : 'Agregado a favoritos'); }}
              className={`w-12 h-12 rounded-xl border flex items-center justify-center transition-colors ${
                inWishlist ? 'bg-rose-50 border-rose-300 text-rose-500' : 'border-champagne-300 text-charcoal-400 hover:border-rose-300 hover:text-rose-500'
              }`}
            >
              <Heart className={`w-5 h-5 ${inWishlist ? 'fill-current' : ''}`} />
            </button>
          </div>

          {/* Trust badges */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            {TRUST_BADGES.map(({ Icon, text }) => (
              <div key={text} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-champagne-50 border border-champagne-200 text-center">
                <Icon className="w-4 h-4 text-primary-500" />
                <span className="font-sans text-xs text-charcoal-500">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-16">
        <div className="flex border-b border-champagne-200">
          {(['description', 'attributes', 'reviews'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 font-sans text-sm font-semibold transition-colors relative ${
                activeTab === tab ? 'text-primary-600' : 'text-charcoal-400 hover:text-charcoal-600'
              }`}
            >
              {tab === 'description' ? 'Descripción' : tab === 'attributes' ? 'Ficha técnica' : `Reseñas (${product.reviews.length})`}
              {activeTab === tab && (
                <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />
              )}
            </button>
          ))}
        </div>

        <div className="py-8">
          {activeTab === 'description' && (
            <div className="prose max-w-none font-sans text-charcoal-600 leading-relaxed whitespace-pre-wrap">
              {product.description || 'Sin descripción disponible.'}
            </div>
          )}

          {activeTab === 'attributes' && (
            <div className="max-w-2xl">
              {product.attributes.length > 0 ? (
                <table className="w-full">
                  <tbody>
                    {product.attributes.map((attr, i) => (
                      <tr key={attr.id} className={i % 2 === 0 ? 'bg-champagne-50' : ''}>
                        <td className="py-3 px-4 font-sans text-sm font-semibold text-charcoal-600 w-1/3 rounded-l-xl">{attr.name}</td>
                        <td className="py-3 px-4 font-sans text-sm text-charcoal-500 rounded-r-xl">{attr.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="font-sans text-charcoal-400">Sin especificaciones técnicas.</p>
              )}
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="space-y-6">
              {product.reviews.length > 0 ? product.reviews.map((review) => (
                <div key={review.id} className="p-5 rounded-2xl bg-champagne-50 border border-champagne-200">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-sans font-semibold text-sm text-charcoal-700">{review.user.name || 'Cliente'}</p>
                      <div className="flex mt-0.5">
                        {[1,2,3,4,5].map((s) => (
                          <Star key={s} className={`w-3.5 h-3.5 ${s <= review.rating ? 'text-primary-400 fill-primary-400' : 'text-charcoal-200'}`} />
                        ))}
                      </div>
                    </div>
                    <span className="font-sans text-xs text-charcoal-400">
                      {new Date(review.createdAt).toLocaleDateString('es-CL')}
                    </span>
                  </div>
                  {review.title && <p className="font-sans font-semibold text-charcoal-700 mb-1">{review.title}</p>}
                  {review.body && <p className="font-sans text-sm text-charcoal-500 leading-relaxed">{review.body}</p>}
                </div>
              )) : (
                <p className="font-sans text-charcoal-400">Aún no hay reseñas para este producto.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
