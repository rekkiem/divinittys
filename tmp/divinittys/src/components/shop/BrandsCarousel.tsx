'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

type Brand = { id: string; name: string; slug: string; logo?: string | null };

export default function BrandsCarousel({ brands }: { brands: Brand[] }) {
  if (!brands.length) return null;

  // Duplicate for infinite scroll effect
  const repeated = [...brands, ...brands, ...brands];

  return (
    <section className="py-16 border-y border-champagne-300 bg-champagne-50/50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 mb-8 text-center">
        <p className="font-sans text-xs font-semibold text-primary-500 tracking-widest uppercase">
          Marcas que manejamos
        </p>
      </div>

      {/* Marquee */}
      <div className="relative">
        <div className="flex gap-8 animate-[marquee_30s_linear_infinite]" style={{ width: 'max-content' }}>
          {repeated.map((brand, i) => (
            <Link
              key={`${brand.id}-${i}`}
              href={`/productos?brand=${brand.slug}`}
              className="flex-none px-8 py-4 bg-white rounded-2xl border border-champagne-300 hover:border-primary-300 hover:shadow-md transition-all duration-300 min-w-[140px] flex items-center justify-center group"
            >
              {brand.logo ? (
                <img src={brand.logo} alt={brand.name} className="h-8 object-contain filter grayscale group-hover:grayscale-0 transition-all" />
              ) : (
                <span className="font-display font-light text-charcoal-400 group-hover:text-primary-500 transition-colors text-lg tracking-widest">
                  {brand.name}
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>

      <style jsx global>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
      `}</style>
    </section>
  );
}
