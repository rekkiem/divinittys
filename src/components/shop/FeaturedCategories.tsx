'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

const categoryIcons: Record<string, string> = {
  default: '✦',
  'cuidado-capilar': '🌿',
  coloracion: '🎨',
  tratamientos: '💆',
  maquillaje: '💄',
  skincare: '✨',
  perfumeria: '🌸',
  uñas: '💅',
  accesorios: '🪄',
};

type Category = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  image?: string | null;
};

export default function FeaturedCategories({ categories }: { categories: Category[] }) {
  if (!categories.length) return null;

  return (
    <section className="py-20 px-4 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
        <div>
          <p className="font-sans text-primary-500 text-xs font-semibold tracking-widest uppercase mb-3">
            Explora
          </p>
          <h2 className="section-title">
            Categorías
            <span className="gradient-text block">Destacadas</span>
          </h2>
        </div>
        <Link href="/productos" className="inline-flex items-center gap-2 font-sans text-sm text-primary-500 hover:text-primary-600 font-semibold group">
          Ver todo
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {categories.slice(0, 10).map((cat, i) => {
          const icon = categoryIcons[cat.slug] || categoryIcons.default;
          return (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
            >
              <Link href={`/productos?category=${cat.slug}`}>
                <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-champagne-100 to-rose-50 border border-champagne-300 hover:border-primary-300 hover:shadow-lg hover:shadow-primary-500/10 transition-all duration-300 p-6 text-center cursor-pointer">
                  {/* Icon */}
                  <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-white shadow-sm flex items-center justify-center text-2xl group-hover:scale-110 transition-transform duration-300">
                    {icon}
                  </div>

                  {/* Name */}
                  <h3 className="font-sans font-semibold text-sm text-charcoal-700 group-hover:text-primary-600 transition-colors leading-tight">
                    {cat.name}
                  </h3>

                  {/* Hover decoration */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary-500/0 to-primary-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
