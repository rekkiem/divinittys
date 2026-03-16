'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Tag, ArrowRight, Clock } from 'lucide-react';
import { formatCLP, calculateDiscount } from '@/lib/utils/api';

type Product = {
  id: string;
  name: string;
  slug: string;
  basePrice: number | string;
  comparePrice?: number | string | null;
  images: { url: string }[];
  brand?: { name: string } | null;
};

export default function OffersBanner({ products }: { products: Product[] }) {
  if (!products.length) return null;

  return (
    <section className="py-16 bg-gradient-to-r from-charcoal-600 via-charcoal-700 to-charcoal-600 relative overflow-hidden">
      {/* BG pattern */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(201,149,106,1) 1px, transparent 1px)`,
          backgroundSize: '30px 30px',
        }}
      />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-500 flex items-center justify-center">
              <Tag className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-display text-3xl lg:text-4xl font-light text-white tracking-tight">
                Ofertas del día
              </h2>
              <div className="flex items-center gap-1.5 text-primary-300 text-sm font-sans mt-0.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Descuentos por tiempo limitado</span>
              </div>
            </div>
          </div>
          <Link
            href="/productos?onSale=true"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-primary-400/50 text-primary-300 hover:bg-primary-500/20 font-sans text-sm font-semibold transition-colors group"
          >
            Ver todas las ofertas
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Products grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {products.slice(0, 4).map((product, i) => {
            const price = Number(product.basePrice);
            const comparePrice = product.comparePrice ? Number(product.comparePrice) : null;
            const discount = comparePrice ? calculateDiscount(price, comparePrice) : 0;

            return (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Link href={`/productos/${product.slug}`}>
                  <div className="group relative bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary-400/40 rounded-2xl overflow-hidden transition-all duration-300">
                    {/* Discount badge */}
                    {discount > 0 && (
                      <div className="absolute top-3 left-3 z-10 bg-rose-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                        -{discount}%
                      </div>
                    )}

                    {/* Image */}
                    <div className="relative aspect-square bg-white/5">
                      {product.images[0]?.url ? (
                        <Image
                          src={product.images[0].url}
                          alt={product.name}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="font-display text-5xl text-white/10 font-light">D</span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-4">
                      {product.brand && (
                        <p className="font-sans text-xs font-semibold text-primary-400 tracking-wider uppercase mb-1">
                          {product.brand.name}
                        </p>
                      )}
                      <h3 className="font-sans text-sm font-medium text-white line-clamp-2 leading-tight mb-3">
                        {product.name}
                      </h3>
                      <div className="flex items-baseline gap-2">
                        <span className="font-sans font-bold text-primary-300 text-lg">
                          {formatCLP(price)}
                        </span>
                        {comparePrice && (
                          <span className="font-sans text-white/40 text-sm line-through">
                            {formatCLP(comparePrice)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
